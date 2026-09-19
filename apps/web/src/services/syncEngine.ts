// apps/web/src/services/syncEngine.ts
//
// VeloTrack Pro 同步核心引擎 (SyncEngine)：
// 协调 Outbox 发件箱消费 (Push) 与 Watermark 增量拉取 (Pull)，广播数据更新事件。

import {
  getAllLocalRides,
  saveLocalRides,
  deleteLocalRide,
  getKv,
  setKv,
} from '../utils/storage/indexedDb';
import { authFetch } from '../utils/activity/adminApiClient';
import { outboxManager } from './outboxManager';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface SyncEvent {
  type: 'status_change' | 'sync_completed' | 'sync_error';
  status: SyncStatus;
  newCount?: number;
  deletedCount?: number;
  updatedCount?: number;
  serverTime?: number;
  message?: string;
}

type SyncListener = (event: SyncEvent) => void;

class SyncEngine {
  private status: SyncStatus = 'idle';
  private listeners: Set<SyncListener> = new Set();
  private lastSyncTime = 0;
  private isPulling = false;
  private minSyncIntervalMs = 45000; // 默认 45 秒节流防抖

  constructor() {
    this.initNetworkListeners();
  }

  private initNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.setStatus('idle');
      this.pullSync({ force: true }).catch(() => {});
    });

    window.addEventListener('offline', () => {
      this.setStatus('offline');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.pullSync().catch(() => {});
      }
    });
  }

  getStatus(): SyncStatus {
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      return 'offline';
    }
    return this.status;
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    // 立即广播当前状态
    listener({ type: 'status_change', status: this.getStatus() });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(status: SyncStatus) {
    this.status = status;
    this.broadcast({ type: 'status_change', status });
  }

  private broadcast(event: SyncEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[SyncEngine] Error in sync listener:', err);
      }
    }
  }

  /**
   * 触发增量拉取与同步
   */
  async pullSync(options: { force?: boolean } = {}): Promise<{
    success: boolean;
    newCount: number;
    deletedCount: number;
    updatedCount: number;
  }> {
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      this.setStatus('offline');
      return { success: false, newCount: 0, deletedCount: 0, updatedCount: 0 };
    }

    const now = Date.now();
    if (!options.force && now - this.lastSyncTime < this.minSyncIntervalMs) {
      return { success: true, newCount: 0, deletedCount: 0, updatedCount: 0 };
    }

    if (this.isPulling) {
      return { success: true, newCount: 0, deletedCount: 0, updatedCount: 0 };
    }

    this.isPulling = true;
    this.setStatus('syncing');

    try {
      // 1. 先尝试消费本地发件箱 (Push 先行)
      await outboxManager.flushOutbox().catch(() => {});

      // 2. 从 IndexedDB 提取上次的高水位游标
      const since = (await getKv<number>('last_sync_timestamp')) || 0;

      let remoteRides: any[] = [];
      let serverTime: number = Date.now();
      let fetchSucceeded = false;

      try {
        const res = await authFetch(`/api/sync?since=${since}`, {}, 15000);
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (Array.isArray(data.rides)) {
            remoteRides = data.rides;
            serverTime = data.server_time || Date.now();
            fetchSucceeded = true;
          }
        }
      } catch {}

      // 若 /api/sync 缺省或未提供 rides（如旧端点或仅 mock /api/rides 的测试环境），回退到 /api/rides
      if (!fetchSucceeded && since === 0) {
        try {
          const fallbackRes = await authFetch('/api/rides', {}, 15000);
          if (fallbackRes.ok) {
            const fallbackData = await fallbackRes.json().catch(() => ({}));
            if (Array.isArray(fallbackData.rides)) {
              remoteRides = fallbackData.rides;
              fetchSucceeded = true;
            }
          }
        } catch {}
      }

      // 若网络请求失败，严禁推进游标，防止时序空洞与静默丢数据
      if (!fetchSucceeded) {
        throw new Error('网络请求异常或同步端点响应无效');
      }

      // 4. 比对差量并沉淀到本地 IndexedDB
      // 关键保护：先读取当前发件箱中待同步的 mutations，避免远端陈旧快照覆盖本地用户刚做的离线写操作
      const { getPendingMutations } = await import('../utils/storage/indexedDb');
      const pendingMutations = await getPendingMutations();
      const pendingDeletedIds = new Set(
        pendingMutations.filter((m) => m.action === 'DELETE_RIDE').map((m) => m.payload?.id)
      );
      const pendingUpdatedTitles = new Map<string, string>(
        pendingMutations
          .filter((m) => m.action === 'UPDATE_TITLE')
          .map((m) => [m.payload?.id, m.payload?.title])
      );

      const localRides = await getAllLocalRides();
      const localMap = new Map<string, any>(localRides.map((r) => [r.id, r]));

      let newCount = 0;
      let deletedCount = 0;
      let updatedCount = 0;

      const toSave: any[] = [];

      for (const item of remoteRides) {
        if (!item || !item.id) continue;

        // 如果该记录在本地发件箱中已被用户删除，坚决不被远端旧数据复活
        if (pendingDeletedIds.has(item.id)) {
          continue;
        }

        // 如果该记录在本地发件箱中有新标题，保留本地最新标题
        if (pendingUpdatedTitles.has(item.id)) {
          item.title = pendingUpdatedTitles.get(item.id)!;
        }

        // 如果远端标记了软删除墓碑
        if (item.deleted_at !== null && item.deleted_at !== undefined) {
          if (localMap.has(item.id)) {
            await deleteLocalRide(item.id);
            deletedCount++;
          }
        } else {
          // 正常新增或修改记录
          const localItem = localMap.get(item.id);
          if (!localItem) {
            if (since > 0) {
              newCount++;
            }
            toSave.push(item);
          } else {
            // 细粒度比较：仅当远端记录更新，或字段有差异时才更新与保存（避免 1000ms 重叠安全窗口引起冗余写）
            const remoteUpdated = item.updated_at || 0;
            const localUpdated = localItem.updated_at || 0;
            if (remoteUpdated > localUpdated || item.title !== localItem.title) {
              updatedCount++;
              toSave.push(item);
            }
          }
        }
      }

      if (toSave.length > 0) {
        await saveLocalRides(toSave);
      }

      // 5. 更新高水位线游标
      await setKv('last_sync_timestamp', serverTime);
      this.lastSyncTime = Date.now();
      this.setStatus('synced');

      // 6. 广播同步结果
      this.broadcast({
        type: 'sync_completed',
        status: 'synced',
        newCount,
        deletedCount,
        updatedCount,
        serverTime,
      });

      return { success: true, newCount, deletedCount, updatedCount };
    } catch (err: any) {
      console.warn('[SyncEngine] Sync failed:', err);
      this.setStatus('error');
      this.broadcast({
        type: 'sync_error',
        status: 'error',
        message: err?.message || '同步失败，请检查网络',
      });
      return { success: false, newCount: 0, deletedCount: 0, updatedCount: 0 };
    } finally {
      this.isPulling = false;
    }
  }

  /**
   * 重置本地同步游标（便于测试或排障重新全量拉取）
   */
  async resetCursor(): Promise<void> {
    await setKv('last_sync_timestamp', 0);
    this.lastSyncTime = 0;
  }
}

export const syncEngine = new SyncEngine();

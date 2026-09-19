// apps/web/src/services/outboxManager.ts
//
// 离线发件箱管理器 (Outbox Pattern)：
// 负责在离线/弱网环境下将写操作入队，并在网络可用时批量推送至 /api/sync/push。

import {
  enqueueMutation,
  getPendingMutations,
  removeMutation,
  updateLocalRideTitle,
  deleteLocalRide,
  type OutboxMutation,
} from '../utils/storage/indexedDb';
import { authFetch } from '../utils/activity/adminApiClient';

let isFlushing = false;

export class OutboxManager {
  /**
   * 修改骑行标题（先乐观更新本地，再压入发件箱）
   */
  async updateRideTitle(id: string, newTitle: string): Promise<string> {
    const clientUpdatedAt = Date.now();
    // 1. 0ms 乐观更新本地 IndexedDB
    await updateLocalRideTitle(id, newTitle, clientUpdatedAt);

    // 2. 压入发件箱
    const mutationId = await enqueueMutation('UPDATE_TITLE', {
      id,
      title: newTitle,
      client_updated_at: clientUpdatedAt,
    });

    // 3. 尝试静默消费
    this.flushOutbox().catch(() => {});
    return mutationId;
  }

  /**
   * 删除骑行记录（先乐观软删除本地，再压入发件箱）
   */
  async deleteRide(id: string): Promise<string> {
    const clientDeletedAt = Date.now();
    // 1. 0ms 乐观清除本地 IndexedDB
    await deleteLocalRide(id);

    // 2. 压入发件箱
    const mutationId = await enqueueMutation('DELETE_RIDE', {
      id,
      client_deleted_at: clientDeletedAt,
    });

    // 3. 尝试静默消费
    this.flushOutbox().catch(() => {});
    return mutationId;
  }

  /**
   * 检查并发射发件箱中的所有 pending 操作
   */
  async flushOutbox(): Promise<{ success: boolean; applied: number; pendingRemaining: number }> {
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
      return { success: false, applied: 0, pendingRemaining: (await getPendingMutations()).length };
    }

    if (isFlushing) {
      return { success: true, applied: 0, pendingRemaining: (await getPendingMutations()).length };
    }

    isFlushing = true;
    let pending: OutboxMutation[] = [];
    try {
      pending = await getPendingMutations();
      if (pending.length === 0) {
        return { success: true, applied: 0, pendingRemaining: 0 };
      }

      // 批量 POST /api/sync/push
      const res = await authFetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mutations: pending.map((m) => ({
            mutation_id: m.mutation_id,
            action: m.action,
            payload: m.payload,
          })),
        }),
      }, 15000);

      if (!res.ok) {
        throw new Error(`Sync push HTTP ${res.status}`);
      }

      const json = await res.json();
      const results = json.results || [];
      const resultMap = new Map<string, any>(results.map((r: any) => [r.mutation_id, r]));

      let applied = 0;
      for (const m of pending) {
        const r = resultMap.get(m.mutation_id);
        // 如果处理成功，或者即使服务端因冲突拒绝（LWW被覆盖/已删除），发件箱也视为消费完毕并出队
        if (r && (r.status === 'applied' || r.status === 'rejected')) {
          await removeMutation(m.mutation_id);
          if (r.status === 'applied') applied++;
        }
      }

      const remaining = (await getPendingMutations()).length;
      return { success: true, applied, pendingRemaining: remaining };
    } catch (err) {
      console.warn('[OutboxManager] Failed to flush outbox:', err);
      try {
        const { incrementMutationRetry } = await import('../utils/storage/indexedDb');
        for (const m of pending) {
          await incrementMutationRetry(m.mutation_id);
        }
      } catch {}
      return { success: false, applied: 0, pendingRemaining: (await getPendingMutations()).length };
    } finally {
      isFlushing = false;
    }
  }

  /**
   * 查询当前发件箱中待发送条数
   */
  async getPendingCount(): Promise<number> {
    const list = await getPendingMutations();
    return list.length;
  }
}

export const outboxManager = new OutboxManager();

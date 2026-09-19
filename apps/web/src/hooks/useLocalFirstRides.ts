// apps/web/src/hooks/useLocalFirstRides.ts
//
// 骑行列表 Local-First 专用 Hook：
// 1. 0ms 优先从 IndexedDB 取数渲染
// 2. 静默监听 SyncEngine 同步完成并无感更新视图
// 3. 改标题与删除实行 0ms 乐观更新并压入离线发件箱

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllLocalRides } from '../utils/storage/indexedDb';
import { syncEngine, type SyncStatus } from '../services/syncEngine';
import { outboxManager } from '../services/outboxManager';

export function useLocalFirstRides() {
  const [rides, setRides] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncEngine.getStatus());
  const isMountedRef = useRef(true);

  // 1. 挂载时从本地 IndexedDB 立即取数（0ms 呈现）
  const loadFromLocal = useCallback(async () => {
    try {
      const cached = await getAllLocalRides();
      if (isMountedRef.current) {
        if (cached && cached.length > 0) {
          setRides(cached);
          setIsLoading(false);
        }
      }
      return cached;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // 优先读取本地
    loadFromLocal().then((cached) => {
      // 若本地为空，则保持 loading，触发远端同步
      if (!cached || cached.length === 0) {
        setIsLoading(true);
      }
      syncEngine.pullSync().catch(() => {});
    });

    // 订阅同步引擎事件
    const unsubscribe = syncEngine.subscribe(async (event) => {
      if (!isMountedRef.current) return;
      setSyncStatus(event.status);

      if (event.type === 'sync_completed') {
        const fresh = await getAllLocalRides();
        if (isMountedRef.current) {
          setRides(fresh);
          setIsLoading(false);
        }
      } else if (event.type === 'sync_error') {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMountedRef.current = false;
      unsubscribe();
    };
  }, [loadFromLocal]);

  // 2. 乐观更新：改标题
  const updateTitle = useCallback(async (id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    // 0ms 乐观更新 React State
    setRides((prev) =>
      prev.map((r) => (r.id === id ? { ...r, title: trimmed, updated_at: Date.now() } : r))
    );

    // 压入发件箱并持久化 IndexedDB
    await outboxManager.updateRideTitle(id, trimmed);
  }, []);

  // 3. 乐观更新：删除记录
  const deleteRide = useCallback(async (id: string) => {
    // 0ms 乐观移除 React State
    setRides((prev) => prev.filter((r) => r.id !== id));

    // 压入发件箱并从本地清除
    await outboxManager.deleteRide(id);
  }, []);

  // 4. 手动强制刷新
  const refetch = useCallback(async () => {
    await syncEngine.pullSync({ force: true });
  }, []);

  return {
    rides,
    isLoading,
    isSyncing: syncStatus === 'syncing',
    syncStatus,
    updateTitle,
    deleteRide,
    refetch,
  };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllLocalRides, saveLocalRides } from '../utils/storage/indexedDb';

/**
 * 统一取数 hook：封装 loading / error / data / refetch 四态。
 * 针对 /api/rides 原生支持 Local-First 0ms 瞬间秒开与后台静默重对齐（SWR）。
 *
 * @param url       请求地址；传 null 时不发起请求（用于条件取数）
 * @param select    从响应 JSON 中挑选数据的镜头函数，默认原样返回
 */
export function useApi<T>(url: string | null, select: (json: any) => T = (j) => j as T) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(url !== null);
  const [error, setError] = useState<string | null>(null);
  // 镜头函数可能内联创建，用 ref 保证其最新引用而不触发重复请求
  const selectRef = useRef(select);
  selectRef.current = select;
  const hasLocalDataRef = useRef(false);

  const load = useCallback(
    async (silent = false) => {
      if (url === null) return;
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(selectRef.current(json));
        setError(null);

        // 若是骑行列表，静默回写到本地 IndexedDB 保持持久化（同时保护发件箱未决修改，防止旧数据覆盖）
        if (url === '/api/rides' && Array.isArray(json.rides)) {
          import('../utils/storage/indexedDb').then(async ({ getPendingMutations, saveLocalRides: saveSafeRides }) => {
            try {
              const pending = await getPendingMutations();
              const pendingDeleted = new Set(pending.filter((m) => m.action === 'DELETE_RIDE').map((m) => m.payload?.id));
              const pendingTitles = new Map(pending.filter((m) => m.action === 'UPDATE_TITLE').map((m) => [m.payload?.id, m.payload?.title]));
              const safeRides = json.rides
                .filter((r: any) => !pendingDeleted.has(r.id))
                .map((r: any) => (pendingTitles.has(r.id) ? { ...r, title: pendingTitles.get(r.id) } : r));
              saveSafeRides(safeRides).catch(() => {});
            } catch {
              saveSafeRides(json.rides).catch(() => {});
            }
          }).catch(() => {});
        }
      } catch (err) {
        console.error(`[useApi] 请求失败: ${url}`, err);
        // 若本地已有缓存支撑离线可用，则不展示红屏错误，保留数据
        if (!hasLocalDataRef.current) {
          setError('数据加载失败，请稍后重试');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [url]
  );

  useEffect(() => {
    let cancelled = false;
    let unsubscribeSync: (() => void) | null = null;

    // 针对 /api/rides 实行 Local-First：优先读 IndexedDB (0ms) + 监听全局同步引擎事件
    if (url === '/api/rides') {
      getAllLocalRides().then((cached) => {
        if (cancelled) return;
        if (cached && cached.length > 0) {
          hasLocalDataRef.current = true;
          setData(selectRef.current({ rides: cached }));
          setIsLoading(false);
          // 后台静默对齐，不触发骨架屏
          load(true);
        } else {
          load(false);
        }
      }).catch(() => {
        if (!cancelled) load(false);
      });

      import('../services/syncEngine').then(({ syncEngine }) => {
        if (cancelled) return;
        unsubscribeSync = syncEngine.subscribe(async (event) => {
          if (cancelled) return;
          if (event.type === 'sync_completed') {
            const fresh = await getAllLocalRides();
            if (!cancelled && fresh && fresh.length > 0) {
              setData(selectRef.current({ rides: fresh }));
            }
          }
        });
      }).catch(() => {});
    } else {
      load(false);
    }

    return () => {
      cancelled = true;
      if (unsubscribeSync) {
        unsubscribeSync();
      }
    };
  }, [load, url]);

  return { data, isLoading, error, refetch: load };
}

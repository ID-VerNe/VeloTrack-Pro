import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 统一取数 hook：封装 loading / error / data / refetch 四态。
 * 替代散落各页面的 useEffect + fetch 模式，保证错误必被 UI 呈现而非静默吞掉。
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
      } catch (err) {
        console.error(`[useApi] 请求失败: ${url}`, err);
        setError('数据加载失败，请稍后重试');
      } finally {
        setIsLoading(false);
      }
    },
    [url]
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, isLoading, error, refetch: load };
}

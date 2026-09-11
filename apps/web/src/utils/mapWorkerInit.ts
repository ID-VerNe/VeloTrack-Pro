import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

/**
 * 显式初始化 MapLibre GL Web Worker URL。
 * Vite 打包时通过 ?worker&url 将 worker 及其依赖 (maplibre-gl-shared.mjs)
 * 正确打包为独立的 bundle 资源，避免生产环境因相对路径找不到 maplibre-gl-worker.mjs
 * 而回退到 index.html 导致 "Failed to load module script: non-JavaScript MIME type of text/html" 错误。
 */
export function initMapLibreWorker(): void {
  if (typeof setWorkerUrl === 'function' && workerUrl) {
    setWorkerUrl(workerUrl);
  }
}

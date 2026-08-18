import { Marker, Popup } from 'maplibre-gl';
import type { PauseCluster } from '../../utils/telemetrySegments';

/**
 * 创建路线起点 Marker
 */
export function createStartMarker(coord: [number, number]): Marker {
  const startEl = document.createElement('div');
  startEl.className = 'relative flex items-center justify-center';
  startEl.innerHTML = `
    <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-slate-400 opacity-40"></span>
    <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-slate-900 border-2 border-white shadow-sm"></span>
  `;
  return new Marker({ element: startEl }).setLngLat(coord);
}

/**
 * 创建路线终点 Marker
 */
export function createFinishMarker(coord: [number, number]): Marker {
  const finishEl = document.createElement('div');
  finishEl.className = 'relative flex items-center justify-center -translate-y-1.5';
  finishEl.innerHTML = `
    <div class="bg-slate-900 text-white px-1.5 py-0.5 rounded text-[10px] font-mono shadow-sm border border-white flex items-center space-x-1">
      <span>🏁</span>
      <span>END</span>
    </div>
  `;
  return new Marker({ element: finishEl }).setLngLat(coord);
}

/**
 * 创建 5km / 10km 里程碑 Marker
 */
export function createMilestoneMarker(
  km: number,
  coord: [number, number],
  milestoneClass: string,
  onClick?: (km: number) => void
): Marker {
  const milestoneEl = document.createElement('div');
  milestoneEl.className = 'relative flex items-center justify-center cursor-pointer select-none';
  milestoneEl.innerHTML = `
    <div class="px-1.5 py-0.5 rounded font-mono font-medium text-[10px] border flex items-center space-x-0.5 transition-transform hover:scale-105 ${milestoneClass}">
      <span>${km}</span>
      <span class="text-[8px] opacity-70">km</span>
    </div>
  `;
  if (onClick) {
    milestoneEl.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick(km);
    });
  }
  return new Marker({ element: milestoneEl }).setLngLat(coord);
}

/**
 * 创建真实路口停顿与红绿灯等待聚类 Marker 与弹窗
 */
export function createPauseMarker(
  cluster: PauseCluster,
  coord: [number, number],
  onClick?: (cluster: PauseCluster) => void
): Marker {
  const pauseEl = document.createElement('div');
  pauseEl.className =
    'relative flex items-center justify-center cursor-pointer group hover:scale-110 transition-transform';
  pauseEl.innerHTML = `
    <div class="relative w-4 h-4 rounded-full bg-slate-100 text-slate-700 border border-slate-300 shadow-sm flex items-center justify-center text-[9px] font-mono font-semibold">
      P
    </div>
  `;

  const pausePopup = new Popup({ offset: 10, className: 'pause-popup' }).setHTML(`
    <div style="padding: 6px 8px; max-width: 220px; font-family: monospace;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
        <span style="font-weight: 600; font-size: 11px; color: #0F172A;">${cluster.title}</span>
        <span style="font-size: 10px; background: #F1F5F9; color: #475569; padding: 1px 4px; border-radius: 2px;">${cluster.durationMins} 分钟</span>
      </div>
      <div style="font-size: 9px; color: #94A3B8; margin-bottom: 4px;">
        距起点 ${cluster.distanceKm} km · 历时第 ${cluster.timeOffsetMins} 分
      </div>
      <p style="font-size: 10px; color: #475569; line-height: 1.4; margin: 0;">
        ${cluster.advice}
      </p>
    </div>
  `);

  if (onClick) {
    pauseEl.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick(cluster);
    });
  }

  return new Marker({ element: pauseEl }).setLngLat(coord).setPopup(pausePopup);
}

/**
 * 创建地图光标滑动交互的 Scrubber Marker 与 Popup
 */
export function createScrubberMarker(): { marker: Marker; popup: Popup } {
  const scrubberEl = document.createElement('div');
  scrubberEl.className = 'relative flex items-center justify-center';
  scrubberEl.innerHTML = `
    <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-slate-400 opacity-40"></span>
    <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-slate-900 border-2 border-white shadow-sm"></span>
  `;
  const marker = new Marker({ element: scrubberEl });

  const popup = new Popup({
    closeButton: false,
    closeOnClick: false,
    offset: 12,
    className: 'scrubber-popup',
  });

  return { marker, popup };
}


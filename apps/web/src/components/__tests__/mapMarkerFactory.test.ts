// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock maplibre-gl：只需 Marker/Popup，用于捕获 element 与 popup.html
vi.mock('maplibre-gl', () => {
  class Marker {
    static instances: any[] = [];
    element: any;
    popup: any;
    constructor(opts: any) {
      this.element = opts?.element;
      Marker.instances.push(this);
    }
    setLngLat() {
      return this;
    }
    addTo() {
      return this;
    }
    setPopup(p: any) {
      this.popup = p;
      return this;
    }
    remove() {}
  }
  class Popup {
    html: any;
    constructor() {}
    setHTML(h: string) {
      this.html = h;
      return this;
    }
    setText() {
      return this;
    }
  }
  return { Marker, Popup };
});

import { Marker, Popup } from 'maplibre-gl';
import {
  createStartMarker,
  createFinishMarker,
  createMilestoneMarker,
  createPauseMarker,
  createScrubberMarker,
} from '../ride-detail/mapMarkerFactory';

/**
 * mapMarkerFactory 纯工厂函数测试
 * 覆盖：起点/终点/里程碑/停顿聚类/Scrubber 各类 Marker 的 DOM 内容、
 * 点击回调与 popup 内容。
 */

describe('mapMarkerFactory', () => {
  beforeEach(() => {
    (Marker as any).instances = [];
  });

  it('createStartMarker 创建起点 Marker，元素含微动动画与 slate 配色', () => {
    const marker = createStartMarker([113.8, 22.5]);
    expect(marker).toBeInstanceOf(Marker);
    expect((marker as any).element.className).toContain('relative flex items-center justify-center');
    expect((marker as any).element.innerHTML).toContain('animate-ping');
    expect((marker as any).element.innerHTML).toContain('bg-slate-400');
    expect((marker as any).element.innerHTML).toContain('bg-slate-900');
  });

  it('createFinishMarker 创建终点 Marker，含旗帜符号与深色底', () => {
    const marker = createFinishMarker([113.8, 22.5]);
    expect(marker).toBeInstanceOf(Marker);
    expect((marker as any).element.className).toContain('-translate-y-1.5');
    expect((marker as any).element.innerHTML).toContain('🏁');
    expect((marker as any).element.innerHTML).toContain('bg-slate-900');
  });

  it('createMilestoneMarker 渲染里程数字、km 后缀与传入的样式类', () => {
    const marker = createMilestoneMarker(5, [113.8, 22.5], 'bg-slate-100 border-slate-300');
    expect((marker as any).element.innerHTML).toContain('5');
    expect((marker as any).element.innerHTML).toContain('>km<');
    expect((marker as any).element.innerHTML).toContain('bg-slate-100');
    expect((marker as any).element.className).toContain('cursor-pointer');
  });

  it('createMilestoneMarker 传入 onClick 后点击元素触发 onClick(km)', () => {
    const onClick = vi.fn();
    const marker = createMilestoneMarker(10, [113.8, 22.5], 'bg-slate-100', onClick);
    (marker as any).element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(10);
  });

  it('createMilestoneMarker 未传 onClick 时点击不抛错', () => {
    const marker = createMilestoneMarker(15, [113.8, 22.5], 'bg-slate-100');
    expect(() =>
      (marker as any).element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    ).not.toThrow();
  });

  it('createPauseMarker 的 popup 包含聚类标题/时长/建议', () => {
    const cluster: any = {
      id: 'pause-0',
      coordIndex: 2,
      coord: [113.8, 22.5],
      distanceKm: 1.2,
      timeOffsetMins: 8,
      durationSeconds: 120,
      durationMins: 2,
      title: '路口红绿灯停顿',
      advice: '起步防护：轻齿比平稳起步',
    };
    const marker = createPauseMarker(cluster, [113.8, 22.5]);
    expect(marker).toBeInstanceOf(Marker);
    expect((marker as any).popup).toBeInstanceOf(Popup);
    expect((marker as any).popup.html).toContain('路口红绿灯停顿');
    expect((marker as any).popup.html).toContain('2 分钟');
    expect((marker as any).popup.html).toContain('1.2 km');
    expect((marker as any).popup.html).toContain('起步防护：轻齿比平稳起步');
    expect((marker as any).element.innerHTML).toContain('bg-slate-100');
    expect((marker as any).element.className).toContain('cursor-pointer');
  });

  it('createPauseMarker 传入 onClick 后点击元素触发 onClick(cluster)', () => {
    const cluster: any = {
      id: 'pause-1',
      coordIndex: 5,
      coord: [113.8, 22.5],
      distanceKm: 3.0,
      timeOffsetMins: 20,
      durationSeconds: 90,
      durationMins: 1.5,
      title: '第 2 处路口等待',
      advice: '中后程衔接：轻踏起步',
    };
    const onClick = vi.fn();
    const marker = createPauseMarker(cluster, [113.8, 22.5], onClick);
    (marker as any).element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(cluster);
  });

  it('createScrubberMarker 返回 { marker, popup }，slate 配色', () => {
    const result = createScrubberMarker();
    expect(result.marker).toBeInstanceOf(Marker);
    expect(result.popup).toBeInstanceOf(Popup);
    expect((result.marker as any).element.className).toContain('relative flex items-center justify-center');
    expect((result.marker as any).element.innerHTML).toContain('bg-slate-400');
    expect((result.marker as any).element.innerHTML).toContain('bg-slate-900');
  });
});

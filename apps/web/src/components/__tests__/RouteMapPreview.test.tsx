// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

// 共享 maplibre-gl 方法 spy，供 mock 工厂引用并支持断言
const { mockMapFns } = vi.hoisted(() => ({
  mockMapFns: {
    addSource: vi.fn(),
    addLayer: vi.fn(),
    fitBounds: vi.fn(),
    resize: vi.fn(),
    remove: vi.fn(),
  },
}));

// Mock maplibre-gl：命名导出 Map/LngLatBounds/Marker
vi.mock('maplibre-gl', () => {
  class Map {
    static instances: any[] = [];
    static listeners: Record<string, Function[]> = {};
    container: any;
    canvas: any;
    constructor(opts: any) {
      this.container = opts?.container;
      this.canvas = { style: {} };
      Map.instances.push(this);
    }
    on(evt: string, layerIdOrCb: any, maybeCb?: Function) {
      const cb = typeof layerIdOrCb === 'function' ? layerIdOrCb : maybeCb;
      if (cb) (Map.listeners[evt] ||= []).push(cb);
    }
    emit(evt: string, ...args: any[]) {
      (Map.listeners[evt] || []).forEach((cb) => cb(...args));
    }
    off() {}
    remove() {
      mockMapFns.remove();
    }
    resize() {
      mockMapFns.resize();
    }
    fitBounds() {
      mockMapFns.fitBounds();
    }
    isStyleLoaded() {
      return true;
    }
    getCanvas() {
      return this.canvas;
    }
    getSource() {
      return false;
    }
    addSource(...args: any[]) {
      mockMapFns.addSource(...args);
    }
    addLayer(...args: any[]) {
      mockMapFns.addLayer(...args);
    }
    getLayer() {
      return {};
    }
    setCenter() {}
    setZoom() {}
    onAdd() {}
  }
  class LngLatBounds {
    extend() {
      return this;
    }
  }
  class Marker {
    static instances: any[] = [];
    element: any;
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
    remove() {}
  }
  return { Map, LngLatBounds, Marker };
});

import { Map as MockMap, Marker as MockMarker } from 'maplibre-gl';
import RouteMapPreview from '../routes/RouteMapPreview';

/**
 * RouteMapPreview 路线预览地图测试
 * 覆盖：load 后绘制轨迹（addSource/addLayer/fitBounds）、起点/终点 Marker、
 * 路线名称展示、空坐标降级。
 */

const coords: [number, number][] = [
  [113.8, 22.5],
  [113.81, 22.51],
  [113.82, 22.52],
];

/** 获取当前最新创建的地图实例 */
function getMap() {
  return (MockMap as any).instances[(MockMap as any).instances.length - 1];
}

describe('RouteMapPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (MockMap as any).instances = [];
    (MockMap as any).listeners = {};
    (MockMarker as any).instances = [];
  });

  it('渲染路线名称与地图容器', () => {
    render(<RouteMapPreview coordinates={coords} routeName="滨江绿道" />);
    expect(screen.getByText('滨江绿道 · 轨迹地图')).toBeInTheDocument();
  });

  it('load 事件触发后 addSource / addLayer / fitBounds 绘制轨迹', () => {
    render(<RouteMapPreview coordinates={coords} routeName="滨江绿道" />);
    const map = getMap();
    map.emit('load');

    expect(mockMapFns.addSource).toHaveBeenCalledWith(
      'preview-route',
      expect.objectContaining({ type: 'geojson' })
    );
    expect(mockMapFns.addLayer).toHaveBeenCalled();
    expect(mockMapFns.fitBounds).toHaveBeenCalled();
  });

  it('load 后创建起点 S 与终点 E 两个 Marker', () => {
    render(<RouteMapPreview coordinates={coords} routeName="滨江绿道" />);
    getMap().emit('load');

    const elements = (MockMarker as any).instances.map((m: any) => m.element);
    expect(elements).toHaveLength(2);
    expect(elements[0].innerText).toBe('S');
    expect(elements[0].title).toBe('起点');
    expect(elements[1].innerText).toBe('E');
    expect(elements[1].title).toBe('终点');
  });

  it('coordinates 为空时不 addSource / 不创建 Marker，但地图正常初始化', () => {
    render(<RouteMapPreview coordinates={[]} routeName="空路线" />);
    expect((MockMap as any).instances).toHaveLength(1);
    getMap().emit('load');
    expect(mockMapFns.addSource).not.toHaveBeenCalled();
    expect((MockMarker as any).instances).toHaveLength(0);
  });

  it('仅 1 个坐标点时只创建起点 Marker', () => {
    render(<RouteMapPreview coordinates={[[113.8, 22.5]]} routeName="单点" />);
    getMap().emit('load');
    expect((MockMarker as any).instances).toHaveLength(1);
    expect((MockMarker as any).instances[0].element.innerText).toBe('S');
  });
});

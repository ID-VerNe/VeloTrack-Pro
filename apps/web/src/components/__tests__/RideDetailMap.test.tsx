// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MapStyleProvider } from '../../contexts/MapStyleContext';

// 共享 maplibre-gl 方法 spy，供 mock 工厂引用并支持断言
const { mockMapFns } = vi.hoisted(() => ({
  mockMapFns: {
    addSource: vi.fn(),
    addLayer: vi.fn(),
    fitBounds: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    setPaintProperty: vi.fn(),
    setStyle: vi.fn(),
    removeLayer: vi.fn(),
    resize: vi.fn(),
    remove: vi.fn(),
  },
}));

// Mock maplibre-gl：命名导出 Map/LngLatBounds/Marker/Popup，支持 emit / once
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
      // 兼容 on(type, cb) 与 on(type, layerId, cb)
      const cb = typeof layerIdOrCb === 'function' ? layerIdOrCb : maybeCb;
      if (cb) (Map.listeners[evt] ||= []).push(cb);
    }
    once(evt: string, layerIdOrCb: any, maybeCb?: Function) {
      const cb = typeof layerIdOrCb === 'function' ? layerIdOrCb : maybeCb;
      if (cb) (Map.listeners[`once:${evt}`] ||= []).push(cb);
    }
    emit(evt: string, ...args: any[]) {
      (Map.listeners[evt] || []).forEach((cb) => cb(...args));
      (Map.listeners[`once:${evt}`] || []).splice(0).forEach((cb) => cb(...args));
    }
    off() {}
    remove() {
      mockMapFns.remove();
    }
    resize() {
      mockMapFns.resize();
    }
    zoomIn() {
      mockMapFns.zoomIn();
    }
    zoomOut() {
      mockMapFns.zoomOut();
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
    removeLayer(...args: any[]) {
      mockMapFns.removeLayer(...args);
    }
    setPaintProperty(...args: any[]) {
      mockMapFns.setPaintProperty(...args);
    }
    setStyle(...args: any[]) {
      mockMapFns.setStyle(...args);
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
  return { Map, LngLatBounds, Marker, Popup };
});

import { Map as MockMap, Marker as MockMarker } from 'maplibre-gl';
import RideDetailMap from '../ride-detail/RideDetailMap';

/**
 * RideDetailMap 骑行详情地图测试
 * 覆盖：load 后绘制分段轨迹（addSource/addLayer/fitBounds/onMapReady）、
 * 缩放与适应按钮、底图样式切换（setStyle + style.load 重绘）、
 * 真实停顿聚类生成 pause marker、空坐标降级。
 */

// 基本骑行路径（3 个点）
const baseCoordinates: [number, number][] = [
  [113.8, 22.5],
  [113.81, 22.51],
  [113.82, 22.52],
];

// 含真实停顿（连续静止点）的路径
const pauseCoordinates: [number, number][] = [
  [113.8, 22.5],
  [113.8, 22.5],
  [113.8, 22.5],
  [113.8, 22.5],
  [113.8, 22.5],
  [113.8001, 22.5],
  [113.8002, 22.5],
];

const baseRide = {
  id: 1,
  title: '测试骑行',
  elapsed_time_seconds: 3600,
  moving_time_seconds: 3600,
  distance_meters: 10000,
};

/** 获取当前最新创建的地图实例 */
function getMap() {
  return (MockMap as any).instances[(MockMap as any).instances.length - 1];
}

function renderMap(props: Record<string, any> = {}) {
  return render(
    <MapStyleProvider>
      <RideDetailMap ride={baseRide} routeCoordinates={baseCoordinates} {...props} />
    </MapStyleProvider>
  );
}

describe('RideDetailMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (MockMap as any).instances = [];
    (MockMap as any).listeners = {};
    (MockMarker as any).instances = [];
  });

  it('load 后绘制分段轨迹并回调 onMapReady', () => {
    const onMapReady = vi.fn();
    renderMap({ onMapReady });
    const map = getMap();
    map.emit('load');

    expect(mockMapFns.addSource).toHaveBeenCalledWith(
      'route-source',
      expect.objectContaining({ type: 'geojson' })
    );
    expect(mockMapFns.addLayer).toHaveBeenCalled();
    expect(mockMapFns.fitBounds).toHaveBeenCalled();
    expect(mockMapFns.resize).toHaveBeenCalled();
    // onMapReady 收到 (map, scrubberMarker, scrubberPopup)
    expect(onMapReady).toHaveBeenCalledTimes(1);
    const [readyMap, marker, popup] = onMapReady.mock.calls[0];
    expect(readyMap).toBe(map);
    expect(marker).toBeInstanceOf(MockMarker);
  });

  it('点击「放大」/「缩小」/「适应全部轨迹」调用对应 map 方法', async () => {
    const user = userEvent.setup();
    renderMap();
    getMap().emit('load');
    mockMapFns.fitBounds.mockClear();

    await user.click(screen.getByTitle('放大'));
    expect(mockMapFns.zoomIn).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTitle('缩小'));
    expect(mockMapFns.zoomOut).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTitle('适应全部轨迹'));
    expect(mockMapFns.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('点击「卫星」切换底图样式：setStyle 被调用，style.load 后重建图层', async () => {
    const user = userEvent.setup();
    renderMap();
    const map = getMap();
    map.emit('load');
    mockMapFns.addLayer.mockClear();

    await user.click(screen.getByText('卫星'));
    expect(mockMapFns.setStyle).toHaveBeenCalledTimes(1);

    // 触发 once('style.load') 注册的回调，应再次调用 addSource/addLayer 重建
    map.emit('style.load');
    expect(mockMapFns.addSource).toHaveBeenCalled();
    expect(mockMapFns.addLayer).toHaveBeenCalled();
  });

  it('检测到真实停顿聚类时生成 pause marker（popup 含聚类标题）', () => {
    const pausedRide = { ...baseRide, moving_time_seconds: 3000 }; // 停顿 600s
    render(
      <MapStyleProvider>
        <RideDetailMap ride={pausedRide} routeCoordinates={pauseCoordinates} />
      </MapStyleProvider>
    );
    const map = getMap();
    map.emit('load');

    const hasPauseMarker = (MockMarker as any).instances.some(
      (m: any) => m.popup && typeof m.popup.html === 'string' && m.popup.html.includes('路口红绿灯停顿')
    );
    expect(hasPauseMarker).toBe(true);
  });

  it('routeCoordinates 为空时不初始化地图', () => {
    render(
      <MapStyleProvider>
        <RideDetailMap ride={baseRide} routeCoordinates={[]} />
      </MapStyleProvider>
    );
    expect((MockMap as any).instances).toHaveLength(0);
  });
});

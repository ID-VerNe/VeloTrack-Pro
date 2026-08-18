// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import polyline from '@mapbox/polyline';

// 共享 maplibre-gl 方法 spy，供 mock 工厂引用并支持断言
const { mockMapFns, navigateMock } = vi.hoisted(() => ({
  mockMapFns: {
    addSource: vi.fn(),
    addLayer: vi.fn(),
    fitBounds: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    setPaintProperty: vi.fn(),
    resize: vi.fn(),
    remove: vi.fn(),
  },
  navigateMock: vi.fn(),
}));

// Mock react-router-dom：保留原实现，仅 spy useNavigate
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await (importOriginal() as Promise<any>);
  return { ...actual, useNavigate: () => navigateMock };
});

// Mock maplibre-gl：命名导出 Map/LngLatBounds/Marker，支持 emit 触发 load
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
      // 兼容 maplibre 两种签名：on(type, cb) 与 on(type, layerId, cb)
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
    setPaintProperty(...args: any[]) {
      mockMapFns.setPaintProperty(...args);
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
    element: any;
    constructor(opts: any) {
      this.element = opts?.element;
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

import DashboardMap from '../dashboard/DashboardMap';
import { Map as MockMap } from 'maplibre-gl';

/**
 * DashboardMap 仪表盘地图测试
 * 覆盖：load 事件后绘制轨迹（addSource/addLayer/fitBounds）、
 * 缩放/适应按钮回调、hoveredRideId 高亮（setPaintProperty）、
 * 轨迹点击导航到骑行详情。
 */

const rides = [
  {
    id: 1,
    title: '晨骑测试',
    summary_polyline: polyline.encode([
      [30, 20],
      [31, 21],
    ]),
  },
];

function renderMap(props: Record<string, any> = {}) {
  return render(
    <MemoryRouter>
      <DashboardMap
        rides={rides}
        selectedCity="all"
        hoveredRideId={null}
        currentMapStyle="light"
        {...props}
      />
    </MemoryRouter>
  );
}

/** 获取当前最新创建的地图实例 */
function getMap() {
  return (MockMap as any).instances[(MockMap as any).instances.length - 1];
}

describe('DashboardMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (MockMap as any).instances = [];
    (MockMap as any).listeners = {};
  });

  it('load 事件触发后为每条轨迹 addSource / addLayer / fitBounds', () => {
    renderMap();
    const map = getMap();
    map.emit('load');

    expect(mockMapFns.addSource).toHaveBeenCalledWith(
      'route-1',
      expect.objectContaining({ type: 'geojson' })
    );
    expect(mockMapFns.addLayer).toHaveBeenCalled();
    expect(mockMapFns.fitBounds).toHaveBeenCalled();
  });

  it('load 事件触发时注册轨迹点击导航（map click -> navigate）', () => {
    renderMap();
    const map = getMap();
    map.emit('load');
    map.emit('click', 'route-hit-1');
    expect(navigateMock).toHaveBeenCalledWith('/ride/1', { state: { from: '/' } });
  });

  it('无轨迹数据时 load 不调用 addSource', () => {
    renderMap({ rides: [] });
    const map = getMap();
    map.emit('load');
    expect(mockMapFns.addSource).not.toHaveBeenCalled();
  });

  it('点击「放大」/「缩小」按钮调用 zoomIn / zoomOut', async () => {
    const user = userEvent.setup();
    renderMap();
    await user.click(screen.getByTitle('放大'));
    expect(mockMapFns.zoomIn).toHaveBeenCalledTimes(1);

    await user.click(screen.getByTitle('缩小'));
    expect(mockMapFns.zoomOut).toHaveBeenCalledTimes(1);
  });

  it('点击「适应」按钮调用 fitBounds', async () => {
    const user = userEvent.setup();
    renderMap();
    getMap().emit('load');
    mockMapFns.fitBounds.mockClear();

    await user.click(screen.getByTitle('适应当前城市所有轨迹'));
    expect(mockMapFns.fitBounds).toHaveBeenCalledTimes(1);
  });

  it('hoveredRideId 命中时对轨迹图层调用 setPaintProperty 高亮', () => {
    renderMap({ hoveredRideId: '1' });
    getMap().emit('load');
    expect(mockMapFns.setPaintProperty).toHaveBeenCalled();
    // 命中路线核心层：line-width 放大为 5.5 高亮
    expect(mockMapFns.setPaintProperty).toHaveBeenCalledWith(
      'route-core-1',
      'line-width',
      5.5
    );
  });
});

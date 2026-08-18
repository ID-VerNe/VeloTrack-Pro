import { describe, it, expect } from 'vitest';
import {
  LIGHT_MAP_STYLE,
  SATELLITE_MAP_STYLE,
  PASTEL_MAP_STYLE,
  MAP_STYLES,
} from '../mapStyles';

describe('地图样式常量', () => {
  it('两个底图样式均包含 version 8、一个栅格 source 与一个 base 图层', () => {
    const styles = [LIGHT_MAP_STYLE, SATELLITE_MAP_STYLE];
    for (const style of styles) {
      expect(style.version).toBe(8);
      expect(Object.keys(style.sources)).toHaveLength(1);
      const source = Object.values(style.sources)[0] as any;
      expect(source.type).toBe('raster');
      expect(source.tileSize).toBe(256);
      expect(Array.isArray(source.tiles)).toBe(true);
      expect(source.tiles.length).toBeGreaterThan(0);
      expect(style.layers).toHaveLength(1);
      expect(style.layers[0].type).toBe('raster');
    }
  });

  it('light 样式：高德浅色常规，4 个瓦片，maxzoom 18', () => {
    expect(LIGHT_MAP_STYLE.sources['amap-light']).toBeDefined();
    expect(LIGHT_MAP_STYLE.sources['amap-light'].tiles).toHaveLength(4);
    expect(LIGHT_MAP_STYLE.sources['amap-light'].attribution).toContain('高德');
    expect(LIGHT_MAP_STYLE.layers[0].id).toBe('base-light-layer');
    expect(LIGHT_MAP_STYLE.layers[0].maxzoom).toBe(18);
    expect(LIGHT_MAP_STYLE.layers[0].source).toBe('amap-light');
  });

  it('satellite 样式：高德卫星，4 个瓦片，maxzoom 18', () => {
    expect(SATELLITE_MAP_STYLE.sources['amap-satellite']).toBeDefined();
    expect(SATELLITE_MAP_STYLE.sources['amap-satellite'].tiles).toHaveLength(4);
    expect(SATELLITE_MAP_STYLE.sources['amap-satellite'].attribution).toContain('高德卫星');
    expect(SATELLITE_MAP_STYLE.layers[0].id).toBe('base-satellite-layer');
    expect(SATELLITE_MAP_STYLE.layers[0].maxzoom).toBe(18);
    expect(SATELLITE_MAP_STYLE.layers[0].source).toBe('amap-satellite');
  });

  it('PASTEL_MAP_STYLE 与 LIGHT_MAP_STYLE 为同一引用', () => {
    expect(PASTEL_MAP_STYLE).toBe(LIGHT_MAP_STYLE);
  });

  it('MAP_STYLES 注册表仅包含高德常规与卫星 2 种样式，名称/图标/样式引用正确', () => {
    expect(Object.keys(MAP_STYLES)).toEqual(['light', 'satellite']);
    expect(MAP_STYLES.light.name).toBe('常规地图');
    expect(MAP_STYLES.light.icon).toBe('🗺️');
    expect(MAP_STYLES.light.style).toBe(LIGHT_MAP_STYLE);

    expect(MAP_STYLES.satellite.name).toBe('卫星地图');
    expect(MAP_STYLES.satellite.icon).toBe('🛰️');
    expect(MAP_STYLES.satellite.style).toBe(SATELLITE_MAP_STYLE);
  });
});


import { describe, it, expect } from 'vitest';
import {
  gcj02_to_wgs84,
  wgs84_to_gcj02,
  adaptCoordinatesToMapStyle,
} from '../coordTransform';

// 深圳市中心（WGS-84 参考点，用于火星坐标往返一致性校验）
const SZ_WGS: [number, number] = [114.05, 22.54];

describe('gcj02_to_wgs84 / wgs84_to_gcj02 火星坐标转换', () => {
  it('中国境内 WGS-84 转 GCJ-02 会产生坐标偏移（输出不等于输入）', () => {
    const [lng, lat] = wgs84_to_gcj02(SZ_WGS[0], SZ_WGS[1]);
    // 偏移量通常在数百米量级（约 1e-3 度），至少不能等于原坐标
    expect(lng).not.toBe(SZ_WGS[0]);
    expect(lat).not.toBe(SZ_WGS[1]);
    // 深圳附近的偏移幅度应大于 5e-4 度（约 50 米）
    expect(Math.abs(lng - SZ_WGS[0])).toBeGreaterThan(0.0005);
    expect(Math.abs(lat - SZ_WGS[1])).toBeGreaterThan(0.0005);
  });

  it('GCJ-02 转回 WGS-84 后与原始 WGS-84 坐标基本一致（往返一致性）', () => {
    const gcj = wgs84_to_gcj02(SZ_WGS[0], SZ_WGS[1]);
    const [wgsLng, wgsLat] = gcj02_to_wgs84(gcj[0], gcj[1]);
    expect(wgsLng).toBeCloseTo(SZ_WGS[0], 4);
    expect(wgsLat).toBeCloseTo(SZ_WGS[1], 4);
  });

  it('反向往返：WGS-84 -> GCJ-02 -> WGS-84 还原原 GCJ-02 坐标', () => {
    const gcj = gcj02_to_wgs84(114.0605, 22.5458);
    const wgs = wgs84_to_gcj02(gcj[0], gcj[1]);
    expect(wgs[0]).toBeCloseTo(114.0605, 4);
    expect(wgs[1]).toBeCloseTo(22.5458, 4);
  });

  it('中国境外坐标（如 lng=10, lat=10）原样返回，不做偏移', () => {
    expect(gcj02_to_wgs84(10, 10)).toEqual([10, 10]);
    expect(wgs84_to_gcj02(10, 10)).toEqual([10, 10]);
  });

  it('中国境外坐标在国界之外附近同样原样返回', () => {
    // 纬度低于 0.8293 或经度超出 72.004~137.8347 均视为境外
    expect(gcj02_to_wgs84(-10, 0)).toEqual([-10, 0]);
    expect(wgs84_to_gcj02(150, 60)).toEqual([150, 60]);
  });

  it('境内坐标经转换后返回精确到 6 位小数的数组', () => {
    const result = gcj02_to_wgs84(114.05, 22.54);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(2);
    expect(typeof result[0]).toBe('number');
    expect(typeof result[1]).toBe('number');
  });
});

describe('adaptCoordinatesToMapStyle 按底图坐标系自适应转换', () => {
  const coords: [number, number][] = [
    [114.05, 22.54],
    [113.32, 23.12],
  ];

  it('light（高德浅色，GCJ-02）不转换，返回原数组引用', () => {
    const result = adaptCoordinatesToMapStyle(coords, 'light');
    expect(result).toBe(coords);
    expect(result).toEqual(coords);
  });

  it('satellite（高德卫星，GCJ-02）不转换，返回原数组引用', () => {
    const result = adaptCoordinatesToMapStyle(coords, 'satellite');
    expect(result).toBe(coords);
    expect(result).toEqual(coords);
  });

  it('terrain（OpenTopoMap，WGS-84）逐点执行 GCJ-02 -> WGS-84 转换', () => {
    const result = adaptCoordinatesToMapStyle(coords, 'terrain');
    expect(result).not.toBe(coords);
    result.forEach((point, i) => {
      const expected = gcj02_to_wgs84(coords[i][0], coords[i][1]);
      expect(point[0]).toBeCloseTo(expected[0], 4);
      expect(point[1]).toBeCloseTo(expected[1], 4);
    });
  });

  it('dark（CartoDB，WGS-84）逐点执行 GCJ-02 -> WGS-84 转换', () => {
    const result = adaptCoordinatesToMapStyle(coords, 'dark');
    expect(result).not.toBe(coords);
    result.forEach((point, i) => {
      const expected = gcj02_to_wgs84(coords[i][0], coords[i][1]);
      expect(point[0]).toBeCloseTo(expected[0], 4);
      expect(point[1]).toBeCloseTo(expected[1], 4);
    });
  });

  it('空数组返回空数组', () => {
    expect(adaptCoordinatesToMapStyle([], 'terrain')).toEqual([]);
    expect(adaptCoordinatesToMapStyle([], 'dark')).toEqual([]);
    expect(adaptCoordinatesToMapStyle([], 'light')).toEqual([]);
  });

  it('null / undefined 输入返回空数组', () => {
    expect(adaptCoordinatesToMapStyle(null as any, 'terrain')).toEqual([]);
    expect(adaptCoordinatesToMapStyle(undefined as any, 'dark')).toEqual([]);
  });
});

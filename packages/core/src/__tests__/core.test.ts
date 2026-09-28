// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  calculateHRZones,
  getHaversineDistanceMeters,
  computeDistanceMeters,
  haversineDistanceKm,
  downsamplePoints,
} from '../index';

describe('calculateHRZones Karvonen 心率区间', () => {
  // 默认 maxHR=188、restingHr=55 → HRR=133
  it('储备 < 60% 属 Z1', () => {
    expect(calculateHRZones(100, 188, 55)).toBe('z1'); // reserve ≈ 0.338
  });
  it('储备 ≥ 90% 属 Z5', () => {
    expect(calculateHRZones(175, 188, 55)).toBe('z5');
    expect(calculateHRZones(188, 188, 55)).toBe('z5');
  });
  it('未传 maxHR 时默认 188/55', () => {
    expect(calculateHRZones(100)).toBe('z1');
    expect(calculateHRZones(180)).toBe('z5');
  });
  it('自定义 maxHR/restingHr', () => {
    // maxHR=200、restingHr=50 → HRR=150
    expect(calculateHRZones(120, 200, 50)).toBe('z1'); // reserve ≈ 0.467
    expect(calculateHRZones(160, 200, 50)).toBe('z3'); // reserve ≈ 0.733
    expect(calculateHRZones(190, 200, 50)).toBe('z5'); // reserve ≈ 0.933
  });
});

describe('getHaversineDistanceMeters 半正矢距离', () => {
  it('同一点距离为 0', () => {
    expect(getHaversineDistanceMeters(30, 120, 30, 120)).toBe(0);
  });
  it('赤道 1 度约 111195 米', () => {
    expect(getHaversineDistanceMeters(0, 0, 0, 1)).toBeCloseTo(111195, 0);
  });
  it('浮点 a>1 时钳制为 0,不返回 NaN', () => {
    // 极远两点不应产出 NaN
    const d = getHaversineDistanceMeters(-89, -179, 89, 179);
    expect(Number.isNaN(d)).toBe(false);
  });
});

describe('computeDistanceMeters [lng,lat] 序对', () => {
  it('与 getHaversineDistanceMeters 等价(仅参数顺序不同)', () => {
    expect(computeDistanceMeters([120, 30], [121, 30]))
      .toBeCloseTo(getHaversineDistanceMeters(30, 120, 30, 121), 6);
  });
});

describe('haversineDistanceKm 千米距离', () => {
  it('北京→上海约 1067km', () => {
    const d = haversineDistanceKm(39.9087, 116.3975, 31.2397, 121.4998);
    expect(d).toBeGreaterThan(1060);
    expect(d).toBeLessThan(1075);
  });
});

describe('downsamplePoints 降采样', () => {
  it('不超过上限原样返回(同引用)', () => {
    const arr = [1, 2, 3];
    expect(downsamplePoints(arr)).toBe(arr);
  });
  it('超过上限按步长均匀取点', () => {
    const arr = [10, 20, 30, 40, 50];
    expect(downsamplePoints(arr, 2)).toEqual([10, 40]);
  });
  it('空数组原样返回', () => {
    expect(downsamplePoints([])).toEqual([]);
  });
});

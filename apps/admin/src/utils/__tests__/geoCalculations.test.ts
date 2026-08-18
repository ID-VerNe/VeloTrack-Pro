import { describe, it, expect } from 'vitest';
import {
  calculateHRZones,
  downsamplePoints,
  getHaversineDistanceMeters,
} from '../geoCalculations';

describe('calculateHRZones 心率区间计算', () => {
  it('心率低于最大心率的 60% 时属于 Z1', () => {
    expect(calculateHRZones(100, 200)).toBe('z1');
  });

  it('心率恰好等于最大心率的 60% 时属于 Z2（边界值）', () => {
    expect(calculateHRZones(120, 200)).toBe('z2');
  });

  it('心率恰好等于最大心率的 70% 时属于 Z3（边界值）', () => {
    expect(calculateHRZones(140, 200)).toBe('z3');
  });

  it('心率恰好等于最大心率的 80% 时属于 Z4（边界值）', () => {
    expect(calculateHRZones(160, 200)).toBe('z4');
  });

  it('心率达到最大心率的 90% 及以上时属于 Z5（边界值）', () => {
    expect(calculateHRZones(180, 200)).toBe('z5');
    expect(calculateHRZones(200, 200)).toBe('z5');
  });

  it('未传入 maxHR 时使用默认值 190', () => {
    expect(calculateHRZones(100)).toBe('z1'); // 100/190 ≈ 0.526
    expect(calculateHRZones(180)).toBe('z5'); // 180/190 ≈ 0.947
  });

  it('支持自定义 maxHR', () => {
    expect(calculateHRZones(100, 150)).toBe('z2'); // 100/150 ≈ 0.667
    expect(calculateHRZones(190, 200)).toBe('z5'); // 0.95
  });
});

describe('downsamplePoints 轨迹点降采样', () => {
  it('点数不超过上限时原样返回（同一引用）', () => {
    const arr = [1, 2, 3];
    expect(downsamplePoints(arr)).toBe(arr);
  });

  it('点数恰好等于上限时原样返回', () => {
    const arr = Array.from({ length: 500 }, (_, i) => i);
    expect(downsamplePoints(arr)).toBe(arr);
  });

  it('点数超过上限时按步长均匀取点', () => {
    // 5 个点、上限 2 → step = ceil(5/2) = 3 → 取索引 0、3
    const arr = [10, 20, 30, 40, 50];
    expect(downsamplePoints(arr, 2)).toEqual([10, 40]);
  });

  it('使用默认上限 500 时对超过 500 点的序列降采样', () => {
    // 1001 个点 → step = ceil(1001/500) = 3 → 取索引 0,3,...,999 → 共 334 个点
    const arr = Array.from({ length: 1001 }, (_, i) => i);
    const result = downsamplePoints(arr);
    expect(result.length).toBe(334);
    expect(result[0]).toBe(0);
    expect(result[1]).toBe(3);
    expect(result[result.length - 1]).toBe(999);
  });

  it('空数组原样返回空数组', () => {
    expect(downsamplePoints([])).toEqual([]);
  });
});

describe('getHaversineDistanceMeters 半正矢距离计算', () => {
  it('同一点距离为 0', () => {
    expect(getHaversineDistanceMeters(30, 120, 30, 120)).toBe(0);
  });

  it('赤道上经度相差 1 度约为 111195 米（已知距离）', () => {
    // R = 6371km，1° 弧长 = 6371000 * π/180 ≈ 111194.93m
    expect(getHaversineDistanceMeters(0, 0, 0, 1)).toBeCloseTo(111195, 0);
  });

  it('纬度方向相差 0.001 度约为 111.2 米', () => {
    expect(getHaversineDistanceMeters(0, 0, 0, 0.001)).toBeCloseTo(111.2, 0);
  });

  it('已知两点（北京→上海）距离落在合理区间', () => {
    // 北京天安门 (39.9087, 116.3975) → 上海外滩 (31.2397, 121.4998)，直线约 1067km
    const d = getHaversineDistanceMeters(39.9087, 116.3975, 31.2397, 121.4998);
    expect(d).toBeGreaterThan(1060000);
    expect(d).toBeLessThan(1075000);
  });
});

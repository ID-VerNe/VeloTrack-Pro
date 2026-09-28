import { describe, it, expect } from 'vitest';
import {
  calculateHRZones,
  downsamplePoints,
  getHaversineDistanceMeters,
} from '../geoCalculations';

describe('calculateHRZones 心率区间计算', () => {
  // Karvonen 储备心率模型：reserve = (hr - restingHr) / (maxHR - restingHr)
  // 默认 maxHR=188、restingHr=55 → HRR=133
  // z1: reserve < 0.60   → hr < 55 + 133*0.60 = 134.8
  // z2: 0.60 ≤ reserve < 0.70 → 134.8 ≤ hr < 148.1
  // z3: 0.70 ≤ reserve < 0.80 → 148.1 ≤ hr < 161.4
  // z4: 0.80 ≤ reserve < 0.90 → 161.4 ≤ hr < 174.7
  // z5: reserve ≥ 0.90 → hr ≥ 174.7

  it('储备 < 60% 属于 Z1', () => {
    expect(calculateHRZones(100, 188, 55)).toBe('z1'); // reserve ≈ 0.338
  });

  it('储备恰好 60% 边界属 Z2', () => {
    expect(calculateHRZones(135, 188, 55)).toBe('z2'); // reserve ≈ 0.601
  });

  it('储备恰好 70% 边界属 Z3', () => {
    expect(calculateHRZones(149, 188, 55)).toBe('z3'); // reserve = 94/133 ≈ 0.707
  });

  it('储备恰好 80% 边界属 Z4', () => {
    expect(calculateHRZones(162, 188, 55)).toBe('z4'); // reserve ≈ 0.805
  });

  it('储备 ≥ 90% 属 Z5', () => {
    expect(calculateHRZones(175, 188, 55)).toBe('z5'); // reserve ≈ 0.902
    expect(calculateHRZones(188, 188, 55)).toBe('z5'); // reserve = 1.0
  });

  it('未传入 maxHR 时使用默认值 188/55', () => {
    expect(calculateHRZones(100)).toBe('z1'); // reserve ≈ 0.338
    expect(calculateHRZones(180)).toBe('z5'); // reserve ≈ 0.940
  });

  it('支持自定义 maxHR/restingHr', () => {
    // maxHR=200、restingHr=50 → HRR=150
    // hr=120 → reserve = 70/150 ≈ 0.467 → z1
    expect(calculateHRZones(120, 200, 50)).toBe('z1');
    // hr=160 → reserve = 110/150 ≈ 0.733 → z3
    expect(calculateHRZones(160, 200, 50)).toBe('z3');
    // hr=190 → reserve = 140/150 ≈ 0.933 → z5
    expect(calculateHRZones(190, 200, 50)).toBe('z5');
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

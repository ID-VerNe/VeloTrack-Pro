// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  calcPercentile,
  deriveCadenceFromSpeed,
  analyzeSpeedDistribution,
} from '../speedDistribution';

describe('speedDistribution 速度分层与稳态巡航特征分析', () => {
  it('正确计算分位数', () => {
    const vals = [10, 20, 30, 40, 50];
    expect(calcPercentile(vals, 50)).toBe(30);
    expect(calcPercentile(vals, 0)).toBe(10);
    expect(calcPercentile(vals, 100)).toBe(50);
  });

  it('正确从时速与 46/15T 齿比反推踏频', () => {
    // 25.5 km/h @ 46/15T -> 约 90 rpm
    const cad = deriveCadenceFromSpeed(25.5, 46, 15, 1.54);
    expect(cad).toBeGreaterThanOrEqual(89);
    expect(cad).toBeLessThanOrEqual(91);
  });

  it('在无逐点明细或数据过少时降级为基于均速的平稳估算模型', () => {
    const res = analyzeSpeedDistribution([], 18.0);
    expect(res.has_detail).toBe(false);
    expect(res.cruising_avg_speed_kmh).toBe(24.2); // 18.0 + 6.2
    expect(res.speed_loss_kmh).toBe(6.2);
    expect(res.derived_cadence_rpm).toBeGreaterThan(80);
  });

  it('在有逐点明细时执行算法4截尾均值并正确输出速度分层与损耗', () => {
    // 模拟一段含停顿、起步、稳态巡航与冲刺的数据
    const points: { t: number; sp: number }[] = [];
    let t = 1000;
    // 10 个停顿点 0km/h
    for (let i = 0; i < 10; i++) points.push({ t: t += 1000, sp: 0.0 });
    // 20 个低速点 8-12 km/h
    for (let i = 0; i < 20; i++) points.push({ t: t += 1000, sp: 10.0 });
    // 30 个节奏点 18 km/h
    for (let i = 0; i < 30; i++) points.push({ t: t += 1000, sp: 18.0 });
    // 40 个巡航点 25-26 km/h (稳态持续 40 秒)
    for (let i = 0; i < 40; i++) points.push({ t: t += 1000, sp: 25.5 });
    // 2 个冲刺点 35 km/h
    for (let i = 0; i < 2; i++) points.push({ t: t += 1000, sp: 35.0 });

    const res = analyzeSpeedDistribution(points, 17.5);
    expect(res.has_detail).toBe(true);
    expect(res.cruising_avg_speed_kmh).toBeGreaterThanOrEqual(24.0);
    expect(res.cruising_avg_speed_kmh).toBeLessThanOrEqual(27.0);
    expect(res.cadence_zone_status).toBe('golden'); // 85-95 rpm 黄金区间
    expect(res.speed_loss_kmh).toBeGreaterThan(5.0);
    expect(res.sustained_segments_count).toBeGreaterThanOrEqual(1);
    expect(res.speed_tiers.paused_pct).toBeGreaterThan(0);
    expect(res.speed_tiers.cruising_pct).toBeGreaterThan(0);
  });
});

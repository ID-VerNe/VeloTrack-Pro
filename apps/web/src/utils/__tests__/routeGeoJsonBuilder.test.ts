import { describe, it, expect } from 'vitest';
import {
  classifySegmentSpeed,
  buildRouteSpeedFeatures,
  SPEED_SEGMENT_COLORS,
} from '../routeGeoJsonBuilder';

describe('routeGeoJsonBuilder 轨迹分段与状态分类', () => {
  it('停顿区间返回灰色 pause 状态且时速为 0', () => {
    const res = classifySegmentSpeed(1.5, true, 15, 25, 45);
    expect(res.status).toBe('paused');
    expect(res.color).toBe(SPEED_SEGMENT_COLORS.paused);
    expect(res.speedKmh).toBe(0);
  });

  it('冲刺区间 (>= 28km/h) 返回红色 sprint 状态', () => {
    const res = classifySegmentSpeed(30, false, 15, 25, 50);
    // (30 / 15) * 25 = 50km/h
    expect(res.status).toBe('sprint');
    expect(res.color).toBe(SPEED_SEGMENT_COLORS.sprint);
    expect(res.speedKmh).toBe(50);
  });

  it('巡航区间 (20~28km/h) 返回绿色 cruising 状态', () => {
    const res = classifySegmentSpeed(15, false, 15, 24, 45);
    // (15 / 15) * 24 = 24km/h
    expect(res.status).toBe('cruising');
    expect(res.color).toBe(SPEED_SEGMENT_COLORS.cruising);
    expect(res.speedKmh).toBe(24);
  });

  it('起步/爬坡区间 (< 20km/h) 返回黄色 tempo 状态，且不低于保底时速 6km/h', () => {
    const res = classifySegmentSpeed(5, false, 15, 20, 40);
    // (5 / 15) * 20 = 6.67km/h -> 6.7
    expect(res.status).toBe('tempo');
    expect(res.color).toBe(SPEED_SEGMENT_COLORS.tempo);
    expect(res.speedKmh).toBe(6.7);
  });

  it('buildRouteSpeedFeatures 正确构造 LineString Feature 与 5km 里程碑', () => {
    // 构造约 12km 的经纬度路线（深圳向东走）
    const coords: [number, number][] = [
      [114.05, 22.54],
      [114.10, 22.54], // ~5.1 km
      [114.15, 22.54], // ~5.1 km
      [114.17, 22.54], // ~2 km
    ];
    const stepDists = [5100, 5100, 2000];
    const pauseIndices = new Set<number>();

    const { features, milestones } = buildRouteSpeedFeatures(
      coords,
      stepDists,
      pauseIndices,
      25,
      45,
      5000
    );

    expect(features).toHaveLength(3);
    expect(features[0].type).toBe('Feature');
    expect(features[0].geometry.type).toBe('LineString');
    expect(features[0].geometry.coordinates).toEqual([coords[0], coords[1]]);
    expect(features[0].properties.segmentIndex).toBe(0);

    // 里程碑：第一段 5.1km >= 5km 触发 5km 标记，第二段 10.2km >= 10km 触发 10km 标记
    expect(milestones.length).toBeGreaterThanOrEqual(2);
    expect(milestones[0].km).toBe(5);
    expect(milestones[1].km).toBe(10);
  });

  it('空点位集合返回空特性与里程碑', () => {
    const { features, milestones } = buildRouteSpeedFeatures([], [], new Set(), 25, 45, 15);
    expect(features).toEqual([]);
    expect(milestones).toEqual([]);
  });
});

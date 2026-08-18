import { describe, it, expect } from 'vitest';
import {
  computeDistanceMeters,
  findClosestTelemetryIndex,
  analyzeRideTelemetry,
} from '../telemetrySegments';

describe('computeDistanceMeters 球面距离', () => {
  it('1 度纬度差约 111195 米（坐标格式为 [lng, lat]）', () => {
    expect(computeDistanceMeters([0, 0], [0, 1])).toBeCloseTo(111194.93, 1);
  });

  it('赤道上 1 度经度差约 111195 米', () => {
    expect(computeDistanceMeters([0, 0], [1, 0])).toBeCloseTo(111194.93, 1);
  });

  it('相同点距离为 0', () => {
    expect(computeDistanceMeters([113.3, 23.1], [113.3, 23.1])).toBe(0);
  });

  it('0.01 度纬度差约 1111.9 米', () => {
    expect(computeDistanceMeters([0, 0], [0, 0.01])).toBeCloseTo(1111.95, 1);
  });

  it('距离对称：A->B 与 B->A 相等', () => {
    const a = computeDistanceMeters([113.0, 23.0], [113.1, 23.1]);
    const b = computeDistanceMeters([113.1, 23.1], [113.0, 23.0]);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('findClosestTelemetryIndex 最近点反查', () => {
  it('空路线返回 {coordIndex:0, chartIndex:0, distanceMeters:Infinity}', () => {
    expect(findClosestTelemetryIndex([0, 0], [], 30)).toEqual({
      coordIndex: 0,
      chartIndex: 0,
      distanceMeters: Infinity,
    });
    expect(findClosestTelemetryIndex([0, 0], null as any, 30)).toEqual({
      coordIndex: 0,
      chartIndex: 0,
      distanceMeters: Infinity,
    });
  });

  it('精确命中轨迹点时距离为 0', () => {
    const route: [number, number][] = [
      [113.0, 23.0],
      [113.1, 23.1],
      [113.2, 23.2],
      [113.3, 23.3],
    ];
    const r = findClosestTelemetryIndex([113.2, 23.2], route, 10);
    expect(r.coordIndex).toBe(2);
    expect(r.distanceMeters).toBe(0);
  });

  it('chartIndex 映射：11 个轨迹点命中第 6 个，6 个图表点 -> 3', () => {
    const route: [number, number][] = [];
    for (let i = 0; i < 11; i++) route.push([113.0 + i * 0.01, 23.0 + i * 0.01]);
    const r = findClosestTelemetryIndex(route[5], route, 6);
    expect(r.coordIndex).toBe(5);
    // progress = 5/10 = 0.5，round(0.5 * 5) = 3
    expect(r.chartIndex).toBe(3);
  });

  it('命中首尾点时 chartIndex 取边界 0 与 totalTelemetryPoints-1', () => {
    const route: [number, number][] = [
      [0, 0],
      [0, 1],
      [1, 1],
    ];
    const first = findClosestTelemetryIndex([0, 0], route, 6);
    expect(first.coordIndex).toBe(0);
    expect(first.chartIndex).toBe(0);

    const last = findClosestTelemetryIndex([1, 1], route, 6);
    expect(last.coordIndex).toBe(2);
    expect(last.chartIndex).toBe(5);
  });

  it('totalTelemetryPoints = 1 时 chartIndex 恒为 0', () => {
    const route: [number, number][] = [
      [0, 0],
      [0, 1],
    ];
    const r = findClosestTelemetryIndex([0, 1], route, 1);
    expect(r.coordIndex).toBe(1);
    expect(r.chartIndex).toBe(0);
  });

  it('目标点在两个轨迹点之间时选取距离更近的一个', () => {
    const route: [number, number][] = [
      [113.0, 23.0],
      [113.1, 23.1],
    ];
    const r = findClosestTelemetryIndex([113.08, 23.08], route, 5);
    expect(r.coordIndex).toBe(1);
    expect(r.distanceMeters).toBeGreaterThan(0);
  });
});

describe('analyzeRideTelemetry 遥测分析引擎', () => {
  const baseRide = {
    elapsed_time_seconds: 3600,
    moving_time_seconds: 3000,
    distance_meters: 30000,
    max_speed_kmh: 40,
    max_altitude_meters: 100,
    total_ascent_meters: 200,
  };

  it('基础统计：双均速、停顿时间、占比、距离与默认图表点数量（30）', () => {
    const route: [number, number][] = [
      [113.3, 23.1],
      [113.31, 23.11],
      [113.32, 23.12],
      [113.33, 23.13],
      [113.34, 23.14],
    ];
    const r = analyzeRideTelemetry(baseRide, route);

    expect(r.stats).toMatchObject({
      totalElapsedSecs: 3600,
      movingSecs: 3000,
      totalPausedSecs: 600,
      elapsedMins: 60,
      movingMins: 50,
      pausedMins: 10,
      movingRatioPct: 83,
      pausedRatioPct: 17,
      movingAvgSpeedKmh: 36,
      elapsedAvgSpeedKmh: 30,
      maxSpeedKmh: 40,
      totalDistKm: 30,
    });

    // 无静止点 -> 无停顿聚类、无 markArea
    expect(r.pauseClusters).toEqual([]);
    expect(r.markAreas).toEqual([]);

    // 步长与累计距离
    expect(r.stepDistances).toHaveLength(4);
    expect(r.cumulativeDistances).toHaveLength(5);
    expect(r.cumulativeDistances[0]).toBe(0);
    expect(r.cumulativeDistances[4]).toBeGreaterThan(0);

    // 图表点：30 个（最小下限）
    expect(r.telemetryPoints).toHaveLength(30);
    expect(r.chartData.numPoints).toBe(30);
    expect(r.chartData.timeLabels).toHaveLength(30);
    expect(r.chartData.speedPoints).toHaveLength(30);
    expect(r.chartData.altPoints).toHaveLength(30);

    r.telemetryPoints.forEach((p, i) => {
      expect(p.index).toBe(i);
      expect(p.totalPoints).toBe(30);
      expect(['cruising', 'paused', 'climbing', 'tempo', 'normal']).toContain(p.status);
      expect(typeof p.speed).toBe('number');
      expect(typeof p.altitude).toBe('number');
      expect(typeof p.timeLabel).toBe('string');
    });

    expect(r.keyPeakIndices.longestPauseCluster).toBeNull();
    // 极速点与海拔峰值的索引应指向真正的最大值
    const maxSpeedVal = Math.max(...r.telemetryPoints.map((p) => p.speed));
    expect(r.telemetryPoints[r.keyPeakIndices.maxSpeedPointIndex].speed).toBe(maxSpeedVal);
    const maxAltVal = Math.max(...r.telemetryPoints.map((p) => p.altitude));
    expect(r.telemetryPoints[r.keyPeakIndices.maxAltPointIndex].altitude).toBe(maxAltVal);
  });

  it('构造大量相邻静止点可生成停顿聚类（avgStep < 3.2）', () => {
    const route: [number, number][] = [[113.0, 23.0]];
    for (let i = 0; i < 12; i++) route.push([113.1, 23.1]); // 12 个完全相同的点

    const r = analyzeRideTelemetry(baseRide, route);

    expect(r.pauseClusters).toHaveLength(1);
    const cluster = r.pauseClusters[0];
    expect(cluster.title).toBe('路口红绿灯停顿');
    expect(cluster.coordIndex).toBe(8);
    expect(cluster.coord).toEqual([113.1, 23.1]);
    // 600s 停顿全部归入唯一聚类
    expect(cluster.durationSeconds).toBe(600);
    expect(cluster.durationMins).toBe(10.0);
    expect(cluster.distanceKm).toBeGreaterThan(0);
    // timeOffsetMins = (8/13) * 60 = 36.923 -> 36.9
    expect(cluster.timeOffsetMins).toBe(36.9);

    // markArea 与最长停顿
    expect(r.markAreas).toHaveLength(1);
    expect(r.keyPeakIndices.longestPauseCluster?.durationSeconds).toBe(600);

    // 停顿区域附近有 paused 状态的图表点且速度为 0
    expect(r.telemetryPoints.some((p) => p.status === 'paused' && p.speed === 0)).toBe(true);
  });

  it('两处相互独立的静止区会聚合成两个停顿聚类（覆盖 gap>4 分支）', () => {
    // 路线：起点 -> 10 个静止点(聚类A) -> 移动点 -> 10 个静止点(聚类B) -> 终点
    const route: [number, number][] = [[113.0, 23.0]];
    for (let i = 0; i < 10; i++) route.push([113.05, 23.05]); // 聚类 A
    route.push([113.1, 23.1]); // 两聚类之间的移动点
    for (let i = 0; i < 10; i++) route.push([113.15, 23.15]); // 聚类 B
    route.push([113.2, 23.2]);

    const r = analyzeRideTelemetry(baseRide, route);

    expect(r.pauseClusters).toHaveLength(2);
    const [clusterA, clusterB] = r.pauseClusters;
    // 聚类 A
    expect(clusterA.title).toBe('第 1 处红绿灯路口');
    expect(clusterA.coordIndex).toBe(5);
    expect(clusterA.durationSeconds).toBe(300);
    expect(clusterA.advice).toContain('起步防护');
    // 聚类 B
    expect(clusterB.title).toBe('第 2 处路口等待');
    expect(clusterB.coordIndex).toBe(16);
    expect(clusterB.durationSeconds).toBe(300);
    expect(clusterB.advice).toContain('中后程衔接');
    // 各生成一个 markArea
    expect(r.markAreas).toHaveLength(2);
    // 最长停顿取时长最大者（两者相同时取先出现者）
    expect(r.keyPeakIndices.longestPauseCluster?.coordIndex).toBe(5);
    expect(r.telemetryPoints.some((p) => p.status === 'paused')).toBe(true);
  });

  it('全静止路线：远离聚类中心的停顿点使用兜底文案（⏸️ 停顿/等红灯）', () => {
    // 30 个完全相同的点，整条路线均被识别为静止
    const route: [number, number][] = [];
    for (let i = 0; i < 30; i++) route.push([113.1, 23.1]);

    const r = analyzeRideTelemetry(baseRide, route);

    // 全部静止点聚合成一个停顿聚类，中心在坐标 14
    expect(r.pauseClusters).toHaveLength(1);
    expect(r.pauseClusters[0].coordIndex).toBe(14);
    expect(r.pauseClusters[0].durationSeconds).toBe(600);
    // 靠近聚类中心的点显示聚类标题
    expect(
      r.telemetryPoints.some((p) => p.statusLabel.includes('路口红绿灯停顿'))
    ).toBe(true);
    // 远离聚类中心（>6）的停顿点显示兜底文案
    expect(r.telemetryPoints.some((p) => p.statusLabel === '⏸️ 停顿/等红灯')).toBe(true);
  });

  it('状态分类：高速段 cruising、低速爬坡段 climbing（无停顿数据时无 paused）', () => {
    const ride = {
      elapsed_time_seconds: 1800,
      moving_time_seconds: 1800, // 无停顿
      distance_meters: 15000, // 停表均速 30 km/h
      max_speed_kmh: 40,
      max_altitude_meters: 100,
      total_ascent_meters: 100, // 爬升 > 40 -> 触发 climbing
    };
    // A 段 8 点间距约 50m（0.00045 度），B 段 8 点间距约 10m（0.00009 度）
    const pts: [number, number][] = [];
    let lat = 23.0;
    for (let i = 0; i < 8; i++) {
      pts.push([113.0, lat]);
      lat += 0.00045;
    }
    for (let i = 0; i < 8; i++) {
      pts.push([113.0, lat]);
      lat += 0.00009;
    }

    const r = analyzeRideTelemetry(ride, pts);
    expect(r.stats.movingAvgSpeedKmh).toBe(30);
    expect(r.stats.movingRatioPct).toBe(100);
    expect(r.pauseClusters).toEqual([]);
    expect(r.telemetryPoints.some((p) => p.status === 'paused')).toBe(false);
    expect(r.telemetryPoints.some((p) => p.status === 'cruising')).toBe(true);
    const climbing = r.telemetryPoints.find((p) => p.status === 'climbing');
    expect(climbing).toBeDefined();
    expect(climbing!.statusLabel).toContain('爬坡');
    expect(climbing!.speed).toBeLessThan(15);
  });

  it('ride 缺省字段时使用默认值；空路线不抛异常并给出 45 个图表点', () => {
    const r = analyzeRideTelemetry({}, []);
    expect(r.stats).toMatchObject({
      totalElapsedSecs: 3600,
      movingSecs: 3600,
      totalPausedSecs: 0,
      movingRatioPct: 100,
      pausedRatioPct: 0,
      movingAvgSpeedKmh: 0,
      elapsedAvgSpeedKmh: 0,
      maxSpeedKmh: 30,
      totalDistKm: 0,
    });
    expect(r.pauseClusters).toEqual([]);
    expect(r.telemetryPoints).toHaveLength(45);
    expect(r.chartData.numPoints).toBe(45);
    expect(r.cumulativeDistances).toEqual([0]);
  });

  it('ride 为 undefined 时同样兜底不抛异常', () => {
    const r = analyzeRideTelemetry(undefined as any, []);
    expect(r.stats.totalElapsedSecs).toBe(3600);
    expect(r.stats.maxSpeedKmh).toBe(30);
    expect(r.telemetryPoints).toHaveLength(45);
  });

  it('单点路线兜底：图表点映射到唯一坐标，速度兜底为 6.0', () => {
    const r = analyzeRideTelemetry(
      { elapsed_time_seconds: 1800, moving_time_seconds: 1800, distance_meters: 10000 },
      [[113.3, 23.1]]
    );
    expect(r.stepDistances).toEqual([]);
    expect(r.cumulativeDistances).toEqual([0]);
    expect(r.telemetryPoints).toHaveLength(30);
    r.telemetryPoints.forEach((p) => expect(p.coordIndex).toBe(0));
    expect(r.telemetryPoints[0].speed).toBe(6.0);
    expect(r.pauseClusters).toEqual([]);
  });

  it('大路线时图表点数量上限为 120', () => {
    const route: [number, number][] = [];
    for (let i = 0; i < 300; i++) route.push([113.0 + i * 0.00001, 23.0 + i * 0.00001]);
    const r = analyzeRideTelemetry(
      { elapsed_time_seconds: 3600, moving_time_seconds: 3600, distance_meters: 10000 },
      route
    );
    expect(r.chartData.numPoints).toBe(120);
    expect(r.telemetryPoints).toHaveLength(120);
    expect(r.stepDistances).toHaveLength(299);
    expect(r.cumulativeDistances).toHaveLength(300);
  });

  it('moving > elapsed 时停顿归零、占比上限 100', () => {
    const r = analyzeRideTelemetry(
      { elapsed_time_seconds: 3000, moving_time_seconds: 3600, distance_meters: 10000 },
      [
        [0, 0],
        [0, 1],
      ]
    );
    expect(r.stats.totalPausedSecs).toBe(0);
    expect(r.stats.movingRatioPct).toBe(100);
    expect(r.stats.pausedRatioPct).toBe(0);
  });

  it('缺少 moving_time_seconds 时以 elapsed_time_seconds 作为运动时间', () => {
    const r = analyzeRideTelemetry(
      { elapsed_time_seconds: 3600, distance_meters: 10000 },
      [
        [0, 0],
        [0, 1],
      ]
    );
    expect(r.stats.movingSecs).toBe(3600);
    expect(r.stats.totalPausedSecs).toBe(0);
    expect(r.stats.movingAvgSpeedKmh).toBe(10.0);
  });
});

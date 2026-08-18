import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeGoalStatsFromRides } from '../goalCalculations';

afterEach(() => {
  vi.useRealTimers();
});

describe('computeGoalStatsFromRides 目标进度统计', () => {
  it('空骑乘（[] / null / undefined）返回全零默认统计与空成就列表', () => {
    const expected = {
      totalDistanceKm: 0,
      totalAscentM: 0,
      bestAvgSpeedKmh: 0,
      bestMovingAvgSpeedKmh: 0,
      maxSprintSpeedKmh: 0,
      longestRideKm: 0,
      thisWeekDistanceKm: 0,
      thisMonthDistanceKm: 0,
      longestRideEvent: null,
      topSprintEvent: null,
      achievements: [],
    };
    expect(computeGoalStatsFromRides([])).toEqual(expected);
    expect(computeGoalStatsFromRides(null as any)).toEqual(expected);
    expect(computeGoalStatsFromRides(undefined as any)).toEqual(expected);
  });

  it('完整统计：累计距离/爬升、最佳均速、极速、最长单次、周/月距离与已解锁成就', () => {
    const rideA = {
      id: 'a',
      title: '晨骑A',
      start_time: new Date(2026, 7, 18, 8, 0, 0).getTime(), // 周二，本周内
      distance_meters: 50000,
      moving_time_seconds: 5400,
      elapsed_time_seconds: 6000,
      total_ascent_meters: 500,
      max_speed_kmh: 55,
    };
    const rideB = {
      id: 'b',
      title: '爬坡B',
      start_time: new Date(2026, 7, 10, 8, 0, 0).getTime(), // 上周，本周外
      distance_meters: 20000,
      moving_time_seconds: 3600,
      elapsed_time_seconds: 4000,
      total_ascent_meters: 800,
      max_speed_kmh: 45,
    };

    const s = computeGoalStatsFromRides([rideA, rideB]);

    // 累计值
    expect(s.totalDistanceKm).toBe(70.0);
    expect(s.totalAscentM).toBe(1300);
    // 最佳停表均速：rideA 50km/1.5h=33.3，rideB 20km/1h=20
    expect(s.bestAvgSpeedKmh).toBe(33.3);
    expect(s.bestMovingAvgSpeedKmh).toBe(33.3);
    expect(s.maxSprintSpeedKmh).toBe(55);
    expect(s.longestRideKm).toBe(50);
    // 周/月范围：以最近一次骑行（08-18）为基准
    expect(s.thisWeekDistanceKm).toBe(50.0); // 只有 rideA
    expect(s.thisMonthDistanceKm).toBe(70.0); // 8 月内两趟都算

    // 事件对象
    expect(s.longestRideEvent?.id).toBe('a');
    expect(s.topSprintEvent?.id).toBe('a');

    // 成就
    expect(s.achievements).toHaveLength(4);
    const ach40 = s.achievements.find((a) => a.id === 'ach_40km')!;
    expect(ach40.unlocked).toBe(true);
    expect(ach40.title).toBe('首次单次破 40km 进阶');
    expect(ach40.desc).toContain('晨骑A');
    expect(ach40.desc).toContain('50.0km');

    const sprint = s.achievements.find((a) => a.id === 'ach_sprint50')!;
    expect(sprint.unlocked).toBe(true);
    expect(sprint.desc).toContain('55.0 km/h');

    const ascent = s.achievements.find((a) => a.id === 'ach_ascent1000')!;
    expect(ascent.unlocked).toBe(true);
    expect(ascent.desc).toContain('1300');

    const knee = s.achievements.find((a) => a.id === 'ach_knee_health')!;
    expect(knee.unlocked).toBe(true);
  });

  it('未达标时成就保持未解锁（进行中）并给出进度描述', () => {
    const ride = {
      id: 'c',
      title: '短途',
      start_time: new Date(2026, 7, 18, 8, 0, 0).getTime(),
      distance_meters: 10000,
      moving_time_seconds: 3600,
      elapsed_time_seconds: 3600,
      total_ascent_meters: 100,
      max_speed_kmh: 30,
    };
    const s = computeGoalStatsFromRides([ride]);
    expect(s.longestRideKm).toBe(10);
    expect(s.maxSprintSpeedKmh).toBe(30);

    const ach40 = s.achievements.find((a) => a.id === 'ach_40km')!;
    expect(ach40.unlocked).toBe(false);
    expect(ach40.date).toBe('进行中');
    expect(ach40.desc).toBe('当前最长单次记录: 10.0km / 40.0km');

    const sprint = s.achievements.find((a) => a.id === 'ach_sprint50')!;
    expect(sprint.unlocked).toBe(false);
    expect(sprint.desc).toBe('当前最高冲刺极速: 30.0 km/h / 50.0 km/h');

    const ascent = s.achievements.find((a) => a.id === 'ach_ascent1000')!;
    expect(ascent.unlocked).toBe(false);
    expect(ascent.desc).toBe('当前累计爬升: 100m / 1000m');
  });

  it('运动时间缺失时用总耗时兜底计算最佳均速，全缺失记 0', () => {
    const withElapsed = {
      start_time: new Date(2026, 7, 18, 8, 0, 0).getTime(),
      distance_meters: 36000,
      elapsed_time_seconds: 3600,
      max_speed_kmh: 10,
    };
    const noTime = {
      start_time: new Date(2026, 7, 18, 8, 0, 0).getTime(),
      distance_meters: 50000,
    };
    const s = computeGoalStatsFromRides([withElapsed, noTime]);
    // withElapsed: 36km / 1h = 36；noTime 无时长 -> 0
    expect(s.bestAvgSpeedKmh).toBe(36.0);
    expect(s.longestRideKm).toBe(50);
    expect(s.longestRideEvent?.id).toBe(undefined);
  });

  it('所有骑行缺少 start_time 时以当前时间（Date.now）为基准计算周/月，不抛异常', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T10:00:00'));
    const rides = [
      { id: 'x', distance_meters: 10000, max_speed_kmh: 30 },
      { id: 'y', distance_meters: 20000, max_speed_kmh: 40 },
    ];
    const s = computeGoalStatsFromRides(rides);
    // start_time 为 0 的骑行不会被计入周/月
    expect(s.thisWeekDistanceKm).toBe(0);
    expect(s.thisMonthDistanceKm).toBe(0);
    expect(s.totalDistanceKm).toBe(30.0);
    expect(s.maxSprintSpeedKmh).toBe(40);
  });
});

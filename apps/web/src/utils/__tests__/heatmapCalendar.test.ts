import { describe, it, expect } from 'vitest';
import { computeHeatmapCalendar } from '../heatmapCalendar';

describe('computeHeatmapCalendar 日历热力图网格推算', () => {
  it('空骑行记录返回 53 周网格且活跃天数为 0', () => {
    const result = computeHeatmapCalendar([], 2026);
    expect(result.weeks).toHaveLength(53);
    expect(result.weeks[0]).toHaveLength(7);
    expect(result.months).toHaveLength(12);
    expect(result.totalYearDistanceKm).toBe('0.0');
    expect(result.activeDaysCount).toBe(0);
  });

  it('能精准聚合指定年份的骑行并排除其他年份', () => {
    const rides = [
      // 2026-05-20 上午 (10 km)
      { id: '1', start_time: new Date('2026-05-20T08:00:00').getTime(), distance_meters: 10000 },
      // 2026-05-20 下午 (25 km 同一天)
      { id: '2', start_time: new Date('2026-05-20T14:00:00').getTime(), distance_meters: 25000 },
      // 2025-05-20 (不同年份)
      { id: '3', start_time: new Date('2025-05-20T08:00:00').getTime(), distance_meters: 50000 },
    ];

    const result = computeHeatmapCalendar(rides, 2026);
    // 10km + 25km = 35km
    expect(result.totalYearDistanceKm).toBe('35.0');
    expect(result.activeDaysCount).toBe(1);

    // 扁平化查找 2026-05-20
    const day = result.weeks.flat().find((d) => d.dateStr.includes('2026-05-20'));
    expect(day).toBeDefined();
    expect(day?.distanceKm).toBe(35);
    expect(day?.count).toBe(2);
    // 35km 处于 [30, 60) 区间 -> level 3
    expect(day?.level).toBe(3);
  });

  it('不同距离阶梯对应正确的活跃等级 (level 1~4)', () => {
    const rides = [
      // Level 1: < 15km
      { start_time: new Date('2026-01-05T08:00:00').getTime(), distance_meters: 12000 },
      // Level 2: 15km ~ 30km
      { start_time: new Date('2026-01-06T08:00:00').getTime(), distance_meters: 22000 },
      // Level 3: 30km ~ 60km
      { start_time: new Date('2026-01-07T08:00:00').getTime(), distance_meters: 45000 },
      // Level 4: >= 60km
      { start_time: new Date('2026-01-08T08:00:00').getTime(), distance_meters: 80000 },
    ];

    const result = computeHeatmapCalendar(rides, 2026);
    const allDays = result.weeks.flat();

    const d1 = allDays.find((d) => d.dateStr.includes('2026-01-05'));
    const d2 = allDays.find((d) => d.dateStr.includes('2026-01-06'));
    const d3 = allDays.find((d) => d.dateStr.includes('2026-01-07'));
    const d4 = allDays.find((d) => d.dateStr.includes('2026-01-08'));

    expect(d1?.level).toBe(1);
    expect(d2?.level).toBe(2);
    expect(d3?.level).toBe(3);
    expect(d4?.level).toBe(4);
    expect(result.activeDaysCount).toBe(4);
  });
});

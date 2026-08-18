/**
 * dateUtils 纯工具模块单元测试
 * 覆盖：周期边界（周/月/半年/年）、自然周范围
 * 所有用例均传入固定的本地基准时间戳，不依赖 Date.now()。
 */
import { describe, it, expect } from 'vitest';
import { getPeriodBoundaries, getNaturalWeekRange } from '../src/utils/dateUtils';

// 一周毫秒数（7 * 24h）
const WEEK_MS = 7 * 24 * 3600 * 1000;

describe('getPeriodBoundaries 周期起止时间戳计算', () => {
  it('week 类型：周三 2024-01-10 所在周以周一 00:00 为起点', () => {
    const base = new Date(2024, 0, 10, 12, 0, 0).getTime(); // 周三
    const res = getPeriodBoundaries('week', base);
    // 2024-01-08 是周一，本周期起点
    expect(res.currentStart).toBe(new Date(2024, 0, 8).getTime());
    expect(res.currentEnd).toBe(res.currentStart + WEEK_MS - 1); // 周日 23:59:59.999
    expect(res.prevStart).toBe(new Date(2024, 0, 1).getTime());
    expect(res.prevEnd).toBe(res.currentStart - 1);
    expect(res.breakdownCount).toBe(7);
    expect(res.breakdownUnit).toBe('day');
    // 边界校验：起点为周一 00:00
    const startDate = new Date(res.currentStart);
    expect(startDate.getDay()).toBe(1);
    expect(startDate.getHours()).toBe(0);
  });

  it('week 类型：周日 2024-01-07 应回退到上周一 2024-01-01', () => {
    const base = new Date(2024, 0, 7, 20, 0, 0).getTime(); // 周日
    const res = getPeriodBoundaries('week', base);
    expect(res.currentStart).toBe(new Date(2024, 0, 1).getTime());
    expect(res.currentEnd).toBe(res.currentStart + WEEK_MS - 1);
  });

  it('week 类型：周一 2024-01-08 当日本周起点不偏移', () => {
    const base = new Date(2024, 0, 8, 6, 30, 0).getTime(); // 周一
    const res = getPeriodBoundaries('week', base);
    expect(res.currentStart).toBe(new Date(2024, 0, 8).getTime());
    expect(res.currentEnd).toBe(new Date(2024, 0, 8).getTime() + WEEK_MS - 1);
    expect(res.prevEnd).toBe(new Date(2024, 0, 8).getTime() - 1);
  });

  it('month 类型：闰年 2024-02 月当月 29 天、上月 31 天', () => {
    const base = new Date(2024, 1, 15, 8, 30, 0).getTime();
    const res = getPeriodBoundaries('month', base);
    expect(res.currentStart).toBe(new Date(2024, 1, 1).getTime());
    expect(res.currentEnd).toBe(new Date(2024, 2, 0, 23, 59, 59, 999).getTime()); // 2024-02-29
    expect(res.prevStart).toBe(new Date(2024, 0, 1).getTime());
    expect(res.prevEnd).toBe(new Date(2024, 1, 0, 23, 59, 59, 999).getTime()); // 2024-01-31
    expect(res.breakdownCount).toBe(4);
    expect(res.breakdownUnit).toBe('week');
  });

  it('month 类型：非闰年 2025-02 当月 28 天', () => {
    const base = new Date(2025, 1, 15).getTime();
    const res = getPeriodBoundaries('month', base);
    expect(res.currentEnd).toBe(new Date(2025, 2, 0, 23, 59, 59, 999).getTime()); // 2025-02-28
    expect(res.prevEnd).toBe(new Date(2025, 1, 0, 23, 59, 59, 999).getTime()); // 2025-01-31
  });

  it('month 类型：12 月当月结束为 12-31，上月为 11-30', () => {
    const base = new Date(2024, 11, 25).getTime();
    const res = getPeriodBoundaries('month', base);
    expect(res.currentEnd).toBe(new Date(2024, 12, 0, 23, 59, 59, 999).getTime()); // 2024-12-31
    expect(res.prevEnd).toBe(new Date(2024, 11, 0, 23, 59, 59, 999).getTime()); // 2024-11-30
  });

  it('half_year 类型：上半年 2024-03-15 起止为 01-01 ~ 06-30，对比期为前一年下半年', () => {
    const base = new Date(2024, 2, 15).getTime();
    const res = getPeriodBoundaries('half_year', base);
    expect(res.currentStart).toBe(new Date(2024, 0, 1).getTime());
    expect(res.currentEnd).toBe(new Date(2024, 6, 0, 23, 59, 59, 999).getTime()); // 2024-06-30
    expect(res.prevStart).toBe(new Date(2023, 6, 1).getTime()); // 2023-07-01
    expect(res.prevEnd).toBe(new Date(2023, 12, 0, 23, 59, 59, 999).getTime()); // 2023-12-31
    expect(res.breakdownCount).toBe(6);
    expect(res.breakdownUnit).toBe('month');
  });

  it('half_year 类型：1 月属于上半年，对比期为前一年下半年（跨年）', () => {
    const base = new Date(2024, 0, 15).getTime();
    const res = getPeriodBoundaries('half_year', base);
    expect(res.currentStart).toBe(new Date(2024, 0, 1).getTime());
    expect(res.prevStart).toBe(new Date(2023, 6, 1).getTime());
    expect(res.prevEnd).toBe(new Date(2023, 12, 0, 23, 59, 59, 999).getTime());
  });

  it('half_year 类型：下半年 2024-09-15 起止为 07-01 ~ 12-31，对比期为当年上半年', () => {
    const base = new Date(2024, 8, 15).getTime();
    const res = getPeriodBoundaries('half_year', base);
    expect(res.currentStart).toBe(new Date(2024, 6, 1).getTime()); // 2024-07-01
    expect(res.currentEnd).toBe(new Date(2024, 12, 0, 23, 59, 59, 999).getTime()); // 2024-12-31
    expect(res.prevStart).toBe(new Date(2024, 0, 1).getTime()); // 2024-01-01
    expect(res.prevEnd).toBe(new Date(2024, 6, 0, 23, 59, 59, 999).getTime()); // 2024-06-30
  });

  it('half_year 类型：6 月 30 日仍属上半年，7 月 1 日起属下半年', () => {
    const firstHalf = getPeriodBoundaries('half_year', new Date(2024, 5, 30).getTime());
    expect(firstHalf.currentStart).toBe(new Date(2024, 0, 1).getTime());
    const secondHalf = getPeriodBoundaries('half_year', new Date(2024, 6, 1).getTime());
    expect(secondHalf.currentStart).toBe(new Date(2024, 6, 1).getTime());
  });

  it('year 类型：闰年 2024 全年起止与上一年对比期', () => {
    const base = new Date(2024, 4, 1).getTime();
    const res = getPeriodBoundaries('year', base);
    expect(res.currentStart).toBe(new Date(2024, 0, 1).getTime());
    expect(res.currentEnd).toBe(new Date(2024, 11, 31, 23, 59, 59, 999).getTime());
    expect(res.prevStart).toBe(new Date(2023, 0, 1).getTime());
    expect(res.prevEnd).toBe(new Date(2023, 11, 31, 23, 59, 59, 999).getTime());
    expect(res.breakdownCount).toBe(12);
    expect(res.breakdownUnit).toBe('month');
  });

  it('未知周期类型回退到 year 逻辑', () => {
    const base = new Date(2024, 4, 1).getTime();
    const res = getPeriodBoundaries('decade' as never, base);
    expect(res.currentStart).toBe(new Date(2024, 0, 1).getTime());
    expect(res.breakdownCount).toBe(12);
    expect(res.breakdownUnit).toBe('month');
  });

  it('week 类型未传基准时间戳时使用当前时间且周期覆盖当前时刻', () => {
    const before = Date.now();
    const res = getPeriodBoundaries('week');
    const after = Date.now();
    expect(res.currentStart).toBeLessThanOrEqual(before);
    expect(res.currentEnd).toBeGreaterThanOrEqual(after);
    expect(res.currentEnd).toBe(res.currentStart + WEEK_MS - 1);
    expect(res.breakdownCount).toBe(7);
  });
});

describe('getNaturalWeekRange 自然周起止范围', () => {
  it('周三 2024-01-10 所在自然周为 01-08 00:00 ~ 01-14 23:59:59.999', () => {
    const base = new Date(2024, 0, 10, 12, 0, 0).getTime();
    const res = getNaturalWeekRange(base);
    expect(res.start).toBe(new Date(2024, 0, 8).getTime());
    expect(res.end).toBe(res.start + WEEK_MS - 1);
  });

  it('周日 2024-01-07 所在自然周起点为 2024-01-01', () => {
    const base = new Date(2024, 0, 7, 23, 0, 0).getTime();
    const res = getNaturalWeekRange(base);
    expect(res.start).toBe(new Date(2024, 0, 1).getTime());
    expect(res.end).toBe(res.start + WEEK_MS - 1);
  });

  it('周一 2024-01-08 所在自然周起点为当天', () => {
    const base = new Date(2024, 0, 8, 0, 0, 0).getTime();
    const res = getNaturalWeekRange(base);
    expect(res.start).toBe(new Date(2024, 0, 8).getTime());
    expect(res.end).toBe(res.start + WEEK_MS - 1);
  });

  it('未传基准时间戳时使用当前时间，周范围覆盖当前时刻', () => {
    const before = Date.now();
    const res = getNaturalWeekRange();
    const after = Date.now();
    expect(res.start).toBeLessThanOrEqual(before);
    expect(res.end).toBeGreaterThanOrEqual(after);
    expect(res.end).toBe(res.start + WEEK_MS - 1);
    expect(new Date(res.start).getDay()).toBe(1); // 周一 00:00
  });
});

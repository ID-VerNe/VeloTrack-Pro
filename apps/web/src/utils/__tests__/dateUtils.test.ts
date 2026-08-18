import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getNaturalWeekRange,
  getNaturalMonthRange,
  formatPeriodTitle,
} from '../dateUtils';

afterEach(() => {
  vi.useRealTimers();
});

describe('getNaturalWeekRange 自然周范围', () => {
  it('周二（2026-08-18）所在自然周为 周一08-17 00:00 ~ 周日08-23 23:59:59.999', () => {
    const { start, end } = getNaturalWeekRange(new Date('2026-08-18T10:00:00').getTime());
    expect(start).toBe(new Date(2026, 7, 17, 0, 0, 0, 0).getTime());
    expect(end).toBe(new Date(2026, 7, 23, 23, 59, 59, 999).getTime());
  });

  it('周日时间戳落入前一周（当周周日结束），起点为上周一', () => {
    const { start, end } = getNaturalWeekRange(new Date('2026-08-23T12:00:00').getTime());
    expect(start).toBe(new Date(2026, 7, 17, 0, 0, 0, 0).getTime());
    expect(end).toBe(new Date(2026, 7, 23, 23, 59, 59, 999).getTime());
  });

  it('周一本身作为基准时，起点就是当天 00:00', () => {
    const { start, end } = getNaturalWeekRange(new Date('2026-08-17T00:00:00').getTime());
    expect(start).toBe(new Date(2026, 7, 17, 0, 0, 0, 0).getTime());
    expect(end).toBe(new Date(2026, 7, 23, 23, 59, 59, 999).getTime());
  });

  it('周中任意时间不影响所属周范围（取整到天）', () => {
    const noon = getNaturalWeekRange(new Date('2026-08-18T23:59:59').getTime());
    const night = getNaturalWeekRange(new Date('2026-08-18T00:00:01').getTime());
    expect(noon).toEqual(night);
  });

  it('不传参数时使用当前时间，返回长度 7 天的范围', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T10:00:00'));
    const { start, end } = getNaturalWeekRange();
    // 周区间应恰好为 7 * 24 * 3600 * 1000 - 1 毫秒
    expect(end - start).toBe(7 * 24 * 3600 * 1000 - 1);
    expect(start).toBe(new Date(2026, 7, 17, 0, 0, 0, 0).getTime());
  });
});

describe('getNaturalMonthRange 自然月范围', () => {
  it('闰年 2 月（2024-02）月末为 2 月 29 日', () => {
    const { start, end } = getNaturalMonthRange(new Date('2024-02-15T10:00:00').getTime());
    expect(start).toBe(new Date(2024, 1, 1, 0, 0, 0, 0).getTime());
    expect(end).toBe(new Date(2024, 1, 29, 23, 59, 59, 999).getTime());
  });

  it('平年 2 月（2026-02）月末为 2 月 28 日', () => {
    const { start, end } = getNaturalMonthRange(new Date('2026-02-10T08:00:00').getTime());
    expect(start).toBe(new Date(2026, 1, 1, 0, 0, 0, 0).getTime());
    expect(end).toBe(new Date(2026, 1, 28, 23, 59, 59, 999).getTime());
  });

  it('8 月（31 天）范围为 08-01 ~ 08-31', () => {
    const { start, end } = getNaturalMonthRange(new Date('2026-08-18T10:00:00').getTime());
    expect(start).toBe(new Date(2026, 7, 1, 0, 0, 0, 0).getTime());
    expect(end).toBe(new Date(2026, 7, 31, 23, 59, 59, 999).getTime());
  });

  it('不传参数时使用当前时间，返回当月整月范围', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-18T10:00:00'));
    const { start, end } = getNaturalMonthRange();
    expect(start).toBe(new Date(2026, 7, 1, 0, 0, 0, 0).getTime());
    expect(end).toBe(new Date(2026, 7, 31, 23, 59, 59, 999).getTime());
  });
});

describe('formatPeriodTitle 周期标题', () => {
  const weekStart = new Date(2026, 7, 17, 0, 0, 0, 0).getTime();
  const weekEnd = new Date(2026, 7, 23, 23, 59, 59, 999).getTime();

  it('周标题：2026年 第33周 (8月17日 - 8月23日)', () => {
    expect(formatPeriodTitle('week', weekStart, weekEnd)).toBe(
      '2026年 第33周 (8月17日 - 8月23日)'
    );
  });

  it('月标题', () => {
    const s = new Date(2026, 7, 15, 0, 0, 0, 0).getTime();
    const e = new Date(2026, 7, 31, 23, 59, 59, 999).getTime();
    expect(formatPeriodTitle('month', s, e)).toBe('2026年 8月度 训练汇总');
  });

  it('半年标题：上半年（月份 < 7）与下半年（月份 >= 7）', () => {
    const s1 = new Date(2026, 2, 1, 0, 0, 0, 0).getTime(); // 3 月
    const s2 = new Date(2026, 6, 1, 0, 0, 0, 0).getTime(); // 7 月
    expect(formatPeriodTitle('half_year', s1, s1)).toBe('2026年 上半年 (1~6月 / 7~12月) 汇总');
    expect(formatPeriodTitle('half_year', s2, s2)).toBe('2026年 下半年 (1~6月 / 7~12月) 汇总');
  });

  it('年度标题', () => {
    const s = new Date(2026, 0, 1, 0, 0, 0, 0).getTime();
    const e = new Date(2026, 11, 31, 23, 59, 59, 999).getTime();
    expect(formatPeriodTitle('year', s, e)).toBe('2026 全年度 训练总览');
  });

  it('startTime 或 endTime 为 0/空时返回空字符串', () => {
    expect(formatPeriodTitle('week', 0, weekEnd)).toBe('');
    expect(formatPeriodTitle('week', weekStart, 0)).toBe('');
    expect(formatPeriodTitle('month', 0 as any, 0 as any)).toBe('');
  });
});

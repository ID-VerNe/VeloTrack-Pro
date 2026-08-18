import { describe, it, expect } from 'vitest';
import {
  calculateCyclingCalories,
  formatDuration,
  formatFriendlyDuration,
  calculateDualSpeeds,
  formatRideDate,
} from '../cyclingCalculations';

describe('calculateCyclingCalories METs 卡路里计算', () => {
  // 固定 1 小时、默认体重 75kg、无爬升时，卡路里 = MET * 75
  it('movingTimeSeconds <= 0 时返回 0', () => {
    expect(calculateCyclingCalories(0, 0, 20, 0)).toBe(0);
    expect(calculateCyclingCalories(10, -100, 20, 0)).toBe(0);
  });

  it('不同速度档位对应不同 MET（<15 / <19.3 / <22.5 / <26 / 其余）', () => {
    const hour = 3600;
    // <15 -> MET 5.5，5.5 * 75 = 412.5 -> 四舍五入 413
    expect(calculateCyclingCalories(10, hour, 14.9, 0)).toBe(413);
    // 15（恰好 >=15）-> MET 6.8，6.8 * 75 = 510
    expect(calculateCyclingCalories(10, hour, 15, 0)).toBe(510);
    // 19.3 恰好不满足 <19.3 -> MET 8.0，600
    expect(calculateCyclingCalories(10, hour, 19.3, 0)).toBe(600);
    // 22.5 恰好不满足 <22.5 -> MET 10.0，750
    expect(calculateCyclingCalories(10, hour, 22.5, 0)).toBe(750);
    // 26 恰好不满足 <26 -> MET 12.5，12.5 * 75 = 937.5 -> 938
    expect(calculateCyclingCalories(10, hour, 26, 0)).toBe(938);
  });

  it('默认体重为 75kg，且支持自定义体重', () => {
    // 1 小时、均速 20（MET 8.0）、体重 75 -> 600
    expect(calculateCyclingCalories(10, 3600, 20, 0)).toBe(600);
    // 体重 90 -> 8.0 * 90 = 720
    expect(calculateCyclingCalories(10, 3600, 20, 0, 90)).toBe(720);
  });

  it('爬升加项按 (爬升米 * (体重/65) * 0.25) 计入', () => {
    // 1 小时、均速 20（MET 8.0）、体重 75、爬升 100：
    // 600 + 100 * (75/65) * 0.25 = 600 + 28.846 = 628.846 -> 629
    expect(calculateCyclingCalories(10, 3600, 20, 100)).toBe(629);
  });

  it('distanceKm 参数不影响结果（当前实现按时间与 MET 计算）', () => {
    const a = calculateCyclingCalories(10, 3600, 20, 0);
    const b = calculateCyclingCalories(200, 3600, 20, 0);
    expect(a).toBe(b);
  });

  it('爬升为 undefined 时按 0 处理', () => {
    expect(calculateCyclingCalories(10, 3600, 20, undefined as any)).toBe(600);
  });
});

describe('formatDuration 时长格式化', () => {
  it('含小时形态 H:MM:SS', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(3661 + 7200)).toBe('3:01:01');
  });

  it('不含小时形态 MM:SS', () => {
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(59)).toBe('00:59');
  });

  it('零值与负值兜底为 00:00', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(undefined as any)).toBe('00:00');
    expect(formatDuration(null as any)).toBe('00:00');
  });

  it('毫秒部分四舍五入到秒', () => {
    expect(formatDuration(59.6)).toBe('01:00');
    expect(formatDuration(3599.5)).toBe('1:00:00');
    expect(formatDuration(65.4)).toBe('01:05');
  });
});

describe('formatFriendlyDuration 友好时长', () => {
  it('含小时时输出 X小时Y分 / X小时', () => {
    expect(formatFriendlyDuration(3661)).toBe('1小时1分');
    expect(formatFriendlyDuration(3600)).toBe('1小时');
    expect(formatFriendlyDuration(7200 + 900)).toBe('2小时15分');
  });

  it('不足 1 小时输出 X分钟，且最少为 1 分钟', () => {
    expect(formatFriendlyDuration(2700)).toBe('45分钟');
    expect(formatFriendlyDuration(0)).toBe('1分钟');
    expect(formatFriendlyDuration(59)).toBe('1分钟');
  });

  it('四舍五入到秒后再格式化', () => {
    expect(formatFriendlyDuration(3599.6)).toBe('1小时');
    expect(formatFriendlyDuration(59.6)).toBe('1分钟');
  });
});

describe('calculateDualSpeeds 双均速与停顿计算', () => {
  it('正常计算停表均速、总均速、停顿时间与运动占比', () => {
    // 10km，运动 1800s，总耗时 3600s
    const r = calculateDualSpeeds(10000, 1800, 3600);
    expect(r.movingAvgSpeedKmh).toBe(20.0);
    expect(r.elapsedAvgSpeedKmh).toBe(10.0);
    expect(r.movingTimeSeconds).toBe(1800);
    expect(r.elapsedTimeSeconds).toBe(3600);
    expect(r.pausedTimeSeconds).toBe(1800);
    expect(r.movingRatioPct).toBe(50);
  });

  it('运动时间超过总耗时（数据异常）时停顿为 0、占比上限 100', () => {
    const r = calculateDualSpeeds(10000, 3600, 1800);
    expect(r.pausedTimeSeconds).toBe(0);
    expect(r.movingRatioPct).toBe(100);
    // elapsed 仍取提供的 1800s，总均速 = 10km / 0.5h = 20.0
    expect(r.elapsedAvgSpeedKmh).toBe(20.0);
    expect(r.movingAvgSpeedKmh).toBe(10.0);
  });

  it('运动时间 <= 0 时用总耗时兜底', () => {
    const r = calculateDualSpeeds(10000, 0, 3600);
    expect(r.movingTimeSeconds).toBe(3600);
    expect(r.movingAvgSpeedKmh).toBe(10.0);
    expect(r.pausedTimeSeconds).toBe(0);
    expect(r.movingRatioPct).toBe(100);
  });

  it('全部为零时兜底为 1 秒，速度 0、占比 100', () => {
    const r = calculateDualSpeeds(0, 0, 0);
    expect(r.movingTimeSeconds).toBe(1);
    expect(r.elapsedTimeSeconds).toBe(1);
    expect(r.movingAvgSpeedKmh).toBe(0);
    expect(r.elapsedAvgSpeedKmh).toBe(0);
    expect(r.pausedTimeSeconds).toBe(0);
    expect(r.movingRatioPct).toBe(100);
  });

  it('总耗时 <= 0 但运动时间有效时用运动时间兜底总耗时', () => {
    const r = calculateDualSpeeds(10000, 1800, 0);
    expect(r.elapsedTimeSeconds).toBe(1800);
    expect(r.elapsedAvgSpeedKmh).toBe(20.0);
    expect(r.pausedTimeSeconds).toBe(0);
  });

  it('均速保留 1 位小数', () => {
    // 10km / 3600s（1 小时）-> 10.0；若用 100m 等会得到小数
    const r = calculateDualSpeeds(10000, 3660, 3660);
    // 10000m / (3660/3600h) = 9.836... -> 9.8
    expect(r.movingAvgSpeedKmh).toBe(9.8);
  });
});

describe('formatRideDate 日期格式化', () => {
  it('本地时间格式化输出 "YYYY年M月D日 HH:MM"', () => {
    const ts = new Date(2026, 7, 18, 9, 5).getTime();
    expect(formatRideDate(ts)).toBe('2026年8月18日 09:05');
  });

  it('分钟不足两位补零', () => {
    const ts = new Date(2026, 7, 18, 23, 7).getTime();
    expect(formatRideDate(ts)).toBe('2026年8月18日 23:07');
  });

  it('支持字符串时间戳输入', () => {
    const d = new Date(2026, 7, 18, 9, 5);
    expect(formatRideDate(d.toString())).toBe('2026年8月18日 09:05');
  });
});

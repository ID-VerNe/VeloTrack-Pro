/**
 * ACSM (美国运动医学学会) 标准骑行能量代谢 (METs) + 爬升克服重力做功计算公式
 */
export function calculateCyclingCalories(
  _distanceKm: number,
  movingTimeSeconds: number,
  avgSpeedKmh: number,
  ascentMeters: number,
  riderWeightKg = 75
): number {
  if (!movingTimeSeconds || movingTimeSeconds <= 0) return 0;
  const hours = movingTimeSeconds / 3600;

  let met = 4.0;
  if (avgSpeedKmh < 15) met = 5.5;
  else if (avgSpeedKmh < 19.3) met = 6.8;
  else if (avgSpeedKmh < 22.5) met = 8.0;
  else if (avgSpeedKmh < 26) met = 10.0;
  else met = 12.5;

  const baseKcal = met * riderWeightKg * hours;
  const climbingKcal = (ascentMeters || 0) * (riderWeightKg / 65) * 0.25;

  return Math.round(baseKcal + climbingKcal);
}

/**
 * 格式化持续时间为 H:MM:SS 或 MM:SS
 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/**
 * 格式化时间为友好文字（如 1小时15分 / 45分钟）
 */
export function formatFriendlyDuration(totalSeconds: number): string {
  const s = Math.round(totalSeconds || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) {
    return `${h}小时${m > 0 ? `${m}分` : ''}`;
  }
  return `${Math.max(1, m)}分钟`;
}

/**
 * 计算停表均速、总均速、停顿时间与运动做功占比
 */
export function calculateDualSpeeds(
  distanceMeters: number,
  movingTimeSeconds: number,
  elapsedTimeSeconds: number
) {
  const distKm = (distanceMeters || 0) / 1000;
  const movingSec = movingTimeSeconds > 0 ? movingTimeSeconds : (elapsedTimeSeconds || 1);
  const elapsedSec = elapsedTimeSeconds > 0 ? elapsedTimeSeconds : movingSec;

  const movingHours = movingSec / 3600;
  const elapsedHours = elapsedSec / 3600;

  const movingAvgSpeedKmh = movingHours > 0 ? Number((distKm / movingHours).toFixed(1)) : 0;
  const elapsedAvgSpeedKmh = elapsedHours > 0 ? Number((distKm / elapsedHours).toFixed(1)) : 0;

  const pausedTimeSeconds = Math.max(0, elapsedSec - movingSec);
  const movingRatioPct = Math.min(100, Math.round((movingSec / elapsedSec) * 100));

  return {
    movingAvgSpeedKmh,
    elapsedAvgSpeedKmh,
    movingTimeSeconds: movingSec,
    elapsedTimeSeconds: elapsedSec,
    pausedTimeSeconds,
    movingRatioPct,
  };
}

/**
 * 格式化时间戳为本地中文日期字符串
 */
export function formatRideDate(timestamp: number | string): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${String(
    date.getHours()
  ).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

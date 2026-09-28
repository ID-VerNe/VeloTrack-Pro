/**
 * 心率区间划分 (Z1~Z5) —— Karvonen 储备心率模型
 *
 * HRR = maxHR - restingHr,区间边界 = restingHr + HRR * 比例
 * 比例边界 0.60/0.70/0.80/0.90
 *
 * 与 apps/android/.../core/GeoCalculations.kt:calculateHRZone 逐字对齐。
 *
 * 默认 maxHR=188 / restingHr=55 兜底,实际值由车手档案
 * /api/ai/rider/profile 的 max_hr / resting_hr 注入,绝不在此硬编码业务值。
 */
export function calculateHRZones(
  hr: number,
  maxHR = 188,
  restingHr = 55
): 'z1' | 'z2' | 'z3' | 'z4' | 'z5' {
  const hrr = Math.max(1, maxHR - restingHr);
  const reserve = (hr - restingHr) / hrr;
  if (reserve < 0.60) return 'z1';
  if (reserve < 0.70) return 'z2';
  if (reserve < 0.80) return 'z3';
  if (reserve < 0.90) return 'z4';
  return 'z5';
}

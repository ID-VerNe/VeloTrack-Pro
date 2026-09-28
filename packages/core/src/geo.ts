/**
 * 球面几何基础:半正矢距离、降采样、坐标纠偏的几何分量
 *
 * 与 apps/android/.../core/GeoCalculations.kt 逐字对齐:
 * - HRR/Haversine 公式一致
 * - NaN 钳制 Math.max(0, 1 - a) 一致
 * - 降采样步长 ceil(size/maxLimit) 一致
 */

import type { GeoPoint } from './index';

/**
 * 半正矢公式 (Haversine formula) 计算两经纬度之间的地表球面距离 (米)
 *
 * 防护:中间值 a 因浮点累积可能 >1(如 1.0000000000000002),此时 1-a 为负,
 * Math.sqrt(负数) 返回 NaN 并沿累加器扩散。此处用 Math.max(0, 1-a) 钳制,
 * 与 Android GeoCalculations.getHaversineDistanceMeters 一致。
 */
export function getHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return R * c;
}

/**
 * 半正矢公式计算经纬度点之间的地表球面距离 (米)，接收 [lng, lat] 坐标对
 */
export function computeDistanceMeters(coord1: [number, number], coord2: [number, number]): number {
  return getHaversineDistanceMeters(coord1[1], coord1[0], coord2[1], coord2[0]);
}

/**
 * 半正矢公式计算两点之间的地表球面距离 (千米)
 */
export function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return getHaversineDistanceMeters(lat1, lng1, lat2, lng2) / 1000;
}

/**
 * 轨迹点位均匀降采样（默认上限 500 点）
 *
 * 步长 = ceil(size/maxLimit),取索引 0,step,2*step,...
 * 与 Android GeoCalculations.downsamplePoints 一致。
 */
export function downsamplePoints<T>(points: T[], maxLimit = 500): T[] {
  if (points.length <= maxLimit) return points;
  const step = Math.ceil(points.length / maxLimit);
  return points.filter((_, i) => i % step === 0);
}

/** 仅供类型导出,确保 GeoPoint 可从 geo 子模块访问 */
export type { GeoPoint };

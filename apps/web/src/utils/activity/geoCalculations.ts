export interface GeoPoint {
  time: number;
  lat?: number;
  lng?: number;
  altitude?: number;
  distance?: number;
  hr?: number;
  cadence?: number;
  speed?: number;
}

/**
 * 依据用户最大心率计算心率区间 (Z1~Z5)
 */
export function calculateHRZones(hr: number, maxHR = 190): 'z1' | 'z2' | 'z3' | 'z4' | 'z5' {
  const percent = hr / maxHR;
  if (percent < 0.6) return 'z1';
  if (percent < 0.7) return 'z2';
  if (percent < 0.8) return 'z3';
  if (percent < 0.9) return 'z4';
  return 'z5';
}

/**
 * 轨迹点位均匀降采样（默认上限 500 点）
 */
export function downsamplePoints<T>(points: T[], maxLimit = 500): T[] {
  if (points.length <= maxLimit) return points;
  const step = Math.ceil(points.length / maxLimit);
  return points.filter((_, i) => i % step === 0);
}

/**
 * 半正矢公式 (Haversine formula) 计算两经纬度之间的地表球面距离 (米)
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
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

import polyline from '@mapbox/polyline';
import type { ParsedTCX } from './activityAggregator';
import { downsamplePoints, getHaversineDistanceMeters } from './geoCalculations';

export interface PrivacyZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

// 脱敏防护参数（米）：
// - SEGMENT_BUFFER：线段穿越判定的附加缓冲，防止采样稀疏时轨迹弦穿透隐私圈
// - SAFE_START_BUFFER：起点坐标需距圆心的额外安全距离，防止"圈外第一个点"暴露住址方位
const SEGMENT_BUFFER = 50;
const SAFE_START_BUFFER = 300;

/**
 * 计算点 C 到线段 AB 的最短距离（米）。
 * 采用局部平面近似（等距圆柱投影），在几公里尺度下误差可忽略。
 */
function distancePointToSegmentMeters(
  cLat: number, cLng: number,
  aLat: number, aLng: number,
  bLat: number, bLng: number
): number {
  const latRef = (cLat * Math.PI) / 180;
  const metersPerDegLat = 111320;
  const metersPerDegLng = 111320 * Math.cos(latRef);

  // 以 C 为原点的局部平面坐标
  const ax = (aLng - cLng) * metersPerDegLng;
  const ay = (aLat - cLat) * metersPerDegLat;
  const bx = (bLng - cLng) * metersPerDegLng;
  const by = (bLat - cLat) * metersPerDegLat;

  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq === 0) return Math.hypot(ax, ay); // A、B 重合，退化为点到点

  let t = (-(ax * abx) - (ay * aby)) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const footX = ax + t * abx;
  const footY = ay + t * aby;
  return Math.hypot(footX, footY);
}

function isPointInSafeBuffer(lat: number, lng: number, zone: PrivacyZone, bufferMeters: number): boolean {
  const d = getHaversineDistanceMeters(
    Number(lat), Number(lng),
    Number(zone.latitude), Number(zone.longitude)
  );
  const safeRadius = Number(zone.radius_meters) + Number(bufferMeters);
  return d <= safeRadius;
}

/**
 * 在客户端本地执行隐私圈擦除，裁剪敏感地理坐标。
 */
export function scrubPrivacyZones(tcxData: ParsedTCX, zones: PrivacyZone[]): ParsedTCX {
  if (!zones || zones.length === 0) {
    return tcxData;
  }

  const points = tcxData.points;
  const scrubFlags = new Array<boolean>(points.length).fill(false);

  // 1) 标记所有圈内点
  points.forEach((pt, i) => {
    if (pt.lat === undefined || pt.lng === undefined) return;
    for (const zone of zones) {
      const d = getHaversineDistanceMeters(Number(pt.lat), Number(pt.lng), Number(zone.latitude), Number(zone.longitude));
      if (d <= Number(zone.radius_meters)) {
        scrubFlags[i] = true;
        break;
      }
    }
  });

  // 2) 线段穿越判定：相邻两点构成的线段进入圈内（含缓冲）时两点都擦除
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.lat === undefined || a.lng === undefined || b.lat === undefined || b.lng === undefined) continue;
    for (const zone of zones) {
      const segDist = distancePointToSegmentMeters(
        Number(zone.latitude), Number(zone.longitude),
        Number(a.lat), Number(a.lng),
        Number(b.lat), Number(b.lng)
      );
      if (segDist <= Number(zone.radius_meters) + Number(SEGMENT_BUFFER)) {
        scrubFlags[i - 1] = true;
        scrubFlags[i] = true;
        break;
      }
    }
  }

  // 3) 起点保护：从轨迹开头推进，距任一圆心不足（半径+安全距离）的点全部擦除
  let safeStart: { lat: number; lng: number } | null = null;
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.lat === undefined || pt.lng === undefined) continue;
    const isUnsafe = zones.some((z) => isPointInSafeBuffer(pt.lat!, pt.lng!, z, SAFE_START_BUFFER));
    if (isUnsafe) {
      scrubFlags[i] = true;
      continue;
    }
    safeStart = { lat: pt.lat, lng: pt.lng };
    break;
  }

  // 应用擦除
  const scrubbedPoints = points.map((pt, i) =>
    scrubFlags[i] && pt.lat !== undefined && pt.lng !== undefined
      ? { ...pt, lat: undefined, lng: undefined }
      : pt
  );

  // 4) 重建 summary_polyline
  const wasScrubbed = scrubFlags.some(Boolean);
  let newPolyline = tcxData.summary_polyline;
  if (wasScrubbed) {
    const validGpsPoints = scrubbedPoints.filter((p) => p.lat !== undefined && p.lng !== undefined);
    const sampledForPolyline = downsamplePoints(validGpsPoints);
    const coordsForPolyline: [number, number][] = sampledForPolyline.map((p) => [p.lat!, p.lng!]);
    newPolyline = polyline.encode(coordsForPolyline);
  }

  return {
    ...tcxData,
    points: scrubbedPoints,
    summary_polyline: newPolyline,
    start_lat: safeStart?.lat,
    start_lng: safeStart?.lng,
  };
}

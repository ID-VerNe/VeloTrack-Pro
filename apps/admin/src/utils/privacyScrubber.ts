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
 * 修复：原实现只判断"采样点是否在圈内"，相邻两点都在圈外时其连线
 * 可以穿过隐私圈内部而不被处理（例：200m 圈 + 100m 点距可深入圈内 6m）。
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

  // C 在直线 AB 上的投影参数 t，夹到 [0,1] 即垂足落在线段上
  let t = (-(ax * abx) - (ay * aby)) / lenSq; // 向量 CA·AB / |AB|²，CA = A - C = (ax, ay)
  t = Math.max(0, Math.min(1, t));
  const footX = ax + t * abx;
  const footY = ay + t * aby;
  return Math.hypot(footX, footY);
}

/** 点到所有隐私圈的最小距离与对应半径（返回 null 表示轨迹无有效坐标） */
function nearestZoneInfo(
  lat: number, lng: number, zones: PrivacyZone[]
): { distance: number; radius: number } | null {
  let nearest: { distance: number; radius: number } | null = null;
  for (const zone of zones) {
    const d = getHaversineDistanceMeters(lat, lng, zone.latitude, zone.longitude);
    if (!nearest || d / Math.max(1, zone.radius_meters) < nearest.distance / Math.max(1, nearest.radius)) {
      nearest = { distance: d, radius: zone.radius_meters };
    }
  }
  return nearest;
}

/**
 * 在客户端本地执行隐私圈擦除，裁剪敏感地理坐标。
 *
 * 三重防护：
 * 1. 圈内采样点擦除（原有逻辑）
 * 2. 线段穿越判定：相邻两点连线进入隐私圈（含缓冲）时，两点一并擦除，
 *    防止"两点在圈外、连线穿圈"的泄露路径
 * 3. 起点保护：start_lat/start_lng 改取距所有圆心超过（半径+安全距离）的
 *    第一个点，修复原先"擦除后起点坐标仍明文上传"的漏洞
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
      const d = getHaversineDistanceMeters(pt.lat, pt.lng, zone.latitude, zone.longitude);
      if (d <= zone.radius_meters) {
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
        zone.latitude, zone.longitude,
        a.lat, a.lng,
        b.lat, b.lng
      );
      if (segDist <= zone.radius_meters + SEGMENT_BUFFER) {
        scrubFlags[i - 1] = true;
        scrubFlags[i] = true;
        break;
      }
    }
  }

  // 3) 起点保护：从轨迹开头推进，距任一圆心不足（半径+安全距离）的点全部擦除，
  //    找到第一个安全点作为新的 start 坐标
  let safeStart: { lat: number; lng: number } | null = null;
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.lat === undefined || pt.lng === undefined) continue;
    const info = nearestZoneInfo(pt.lat, pt.lng, zones);
    if (info && info.distance <= info.radius + SAFE_START_BUFFER) {
      scrubFlags[i] = true; // 距住址过近，一并擦除
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

  // 4) 重建 summary_polyline：若发生过任何擦除则重新编码
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
    // 起点坐标脱敏：无安全点时直接置空，绝不上传圈边坐标
    start_lat: safeStart?.lat,
    start_lng: safeStart?.lng,
  };
}

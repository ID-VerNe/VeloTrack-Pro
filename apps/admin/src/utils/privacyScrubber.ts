import * as turf from '@turf/turf';
import polyline from '@mapbox/polyline';
import type { ParsedTCX } from './activityAggregator';
import { downsamplePoints } from './geoCalculations';

export interface PrivacyZone {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
}

/**
 * 在客户端本地执行隐私圈擦除，裁剪敏感地理坐标
 */
export function scrubPrivacyZones(tcxData: ParsedTCX, zones: PrivacyZone[]): ParsedTCX {
  if (!zones || zones.length === 0) {
    return tcxData;
  }

  let scrubbedCount = 0;

  // 遍历所有点位，如果在隐私圈内，则将坐标设为 undefined
  const scrubbedPoints = tcxData.points.map((pt) => {
    if (pt.lat === undefined || pt.lng === undefined) return pt;

    const point = turf.point([pt.lng, pt.lat]);

    let inZone = false;
    for (const zone of zones) {
      const center = turf.point([zone.longitude, zone.latitude]);
      const distanceMeters = turf.distance(center, point, { units: 'meters' });

      if (distanceMeters <= zone.radius_meters) {
        inZone = true;
        break;
      }
    }

    if (inZone) {
      scrubbedCount++;
      return { ...pt, lat: undefined, lng: undefined };
    }

    return pt;
  });

  // 如果发生了脱敏剪裁，重新生成精简轨迹 (summary_polyline)
  let newPolyline = tcxData.summary_polyline;
  if (scrubbedCount > 0) {
    const validGpsPoints = scrubbedPoints.filter((p) => p.lat !== undefined && p.lng !== undefined);
    const sampledForPolyline = downsamplePoints(validGpsPoints);
    const coordsForPolyline: [number, number][] = sampledForPolyline.map((p) => [p.lat!, p.lng!]);
    newPolyline = polyline.encode(coordsForPolyline);
  }

  return {
    ...tcxData,
    points: scrubbedPoints,
    summary_polyline: newPolyline,
  };
}

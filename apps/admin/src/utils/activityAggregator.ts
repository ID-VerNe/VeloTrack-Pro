import polyline from '@mapbox/polyline';
import { 
  type GeoPoint, 
  calculateHRZones, 
  downsamplePoints, 
  getHaversineDistanceMeters 
} from './geoCalculations';

export type TCXPoint = GeoPoint;

export interface ParsedTCX {
  id: string;
  title: string;
  start_time: number;
  end_time: number;
  elapsed_time_seconds: number;
  moving_time_seconds: number;
  distance_meters: number;
  max_speed_kmh: number;
  avg_speed_kmh: number;
  moving_avg_speed_kmh?: number;
  elapsed_avg_speed_kmh?: number;
  total_ascent_meters: number;
  total_descent_meters: number;
  max_altitude_meters: number;
  avg_heart_rate: number;
  max_heart_rate: number;
  avg_cadence: number;
  max_cadence: number;
  calories: number;
  hr_z1_seconds: number;
  hr_z2_seconds: number;
  hr_z3_seconds: number;
  hr_z4_seconds: number;
  hr_z5_seconds: number;
  start_lat?: number;
  start_lng?: number;
  summary_polyline: string;
  points: TCXPoint[];
}

export interface ActivityAggregationOptions {
  title: string;
  points: TCXPoint[];
  explicitElapsedTimeSeconds?: number;
  explicitDistanceMeters?: number;
  explicitCalories?: number;
  cumulativeClimbMeters?: number;
  cumulativeDecreaseMeters?: number;
  userMaxHr?: number;
}

/**
 * 统一聚合骑行轨迹点位、计算各项生理/运动极值指标并生成编码折线
 */
export function aggregateActivityData(options: ActivityAggregationOptions): ParsedTCX {
  const {
    title,
    points,
    explicitElapsedTimeSeconds = 0,
    explicitDistanceMeters = 0,
    explicitCalories = 0,
    cumulativeClimbMeters = 0,
    cumulativeDecreaseMeters = 0,
    userMaxHr = 190,
  } = options;

  if (!points || points.length === 0) {
    throw new Error('No trackpoints found in activity file.');
  }

  // 确保按时间升序排列
  points.sort((a, b) => a.time - b.time);

  const start_time = points[0].time;
  const end_time = points[points.length - 1].time;
  const elapsed_time_seconds =
    Math.round(explicitElapsedTimeSeconds) ||
    Math.round((end_time - start_time) / 1000) ||
    1;

  let moving_time_seconds = 0;
  let total_ascent_meters = cumulativeClimbMeters;
  let total_descent_meters = cumulativeDecreaseMeters;
  let max_altitude_meters = -Infinity;
  let max_speed_kmh = 0;
  let max_heart_rate = 0;
  let max_cadence = 0;
  let sum_hr = 0, count_hr = 0;
  let sum_cadence = 0, count_cadence = 0;
  let calculatedDistanceMeters = 0;

  const hrZones = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const prev = i > 0 ? points[i - 1] : null;
    const dtSeconds = prev ? (pt.time - prev.time) / 1000 : 0;

    if (prev && pt.lat !== undefined && pt.lng !== undefined && prev.lat !== undefined && prev.lng !== undefined) {
      const stepDist = getHaversineDistanceMeters(prev.lat, prev.lng, pt.lat, pt.lng);
      calculatedDistanceMeters += stepDist;

      if (pt.speed === undefined && dtSeconds > 0 && dtSeconds < 30) {
        const derivedSpeedKmh = (stepDist / dtSeconds) * 3.6;
        if (derivedSpeedKmh < 90) {
          pt.speed = derivedSpeedKmh;
        }
      }
    }

    if (pt.altitude !== undefined) {
      if (pt.altitude > max_altitude_meters) max_altitude_meters = pt.altitude;
      if (cumulativeClimbMeters === 0 && prev && prev.altitude !== undefined) {
        const diff = pt.altitude - prev.altitude;
        if (diff > 0) total_ascent_meters += diff;
        else if (diff < 0) total_descent_meters += Math.abs(diff);
      }
    }

    if (pt.speed !== undefined) {
      if (pt.speed > max_speed_kmh && pt.speed < 90) max_speed_kmh = pt.speed;
      if (pt.speed >= 1.5 && dtSeconds > 0 && dtSeconds < 60) {
        moving_time_seconds += dtSeconds;
      }
    } else if (dtSeconds > 0 && dtSeconds < 60) {
      moving_time_seconds += dtSeconds;
    }

    if (pt.hr !== undefined) {
      if (pt.hr > max_heart_rate) max_heart_rate = pt.hr;
      sum_hr += pt.hr;
      count_hr++;

      const zone = calculateHRZones(pt.hr, userMaxHr);
      hrZones[zone] += Math.round(dtSeconds || 1);
    }

    if (pt.cadence !== undefined) {
      if (pt.cadence > max_cadence) max_cadence = pt.cadence;
      if (pt.cadence > 0) {
        sum_cadence += pt.cadence;
        count_cadence++;
      }
    }
  }

  const explicitTrackpointDist = points.reduce((max, p) => Math.max(max, p.distance || 0), 0);
  const distance_meters =
    explicitTrackpointDist ||
    Math.round(explicitDistanceMeters) ||
    Math.round(calculatedDistanceMeters);

  const finalMovingTime = Math.round(moving_time_seconds) || elapsed_time_seconds;

  // 停表均速 (Moving Avg Speed) 与 总均速 (Elapsed Avg Speed)
  const movingHours = finalMovingTime / 3600;
  const elapsedHours = elapsed_time_seconds / 3600;
  const distKm = distance_meters / 1000;

  const moving_avg_speed_kmh = movingHours > 0 ? Number((distKm / movingHours).toFixed(1)) : 0;
  const elapsed_avg_speed_kmh = elapsedHours > 0 ? Number((distKm / elapsedHours).toFixed(1)) : 0;

  const validGpsPoints = points.filter((p) => p.lat !== undefined && p.lng !== undefined);
  const start_lat = validGpsPoints.length > 0 ? validGpsPoints[0].lat : undefined;
  const start_lng = validGpsPoints.length > 0 ? validGpsPoints[0].lng : undefined;

  const sampledForPolyline = downsamplePoints(validGpsPoints);
  const coordsForPolyline: [number, number][] = sampledForPolyline.map((p) => [p.lat!, p.lng!]);
  const summary_polyline = polyline.encode(coordsForPolyline);

  return {
    id: String(start_time),
    title,
    start_time,
    end_time,
    elapsed_time_seconds,
    moving_time_seconds: finalMovingTime,
    distance_meters,
    max_speed_kmh: Number(max_speed_kmh.toFixed(1)),
    avg_speed_kmh: moving_avg_speed_kmh || elapsed_avg_speed_kmh,
    moving_avg_speed_kmh,
    elapsed_avg_speed_kmh,
    total_ascent_meters: Math.round(total_ascent_meters),
    total_descent_meters: Math.round(total_descent_meters),
    max_altitude_meters: max_altitude_meters !== -Infinity ? Math.round(max_altitude_meters) : 0,
    avg_heart_rate: count_hr > 0 ? Math.round(sum_hr / count_hr) : 0,
    max_heart_rate,
    avg_cadence: count_cadence > 0 ? Math.round(sum_cadence / count_cadence) : 0,
    max_cadence,
    calories: explicitCalories,
    hr_z1_seconds: hrZones.z1,
    hr_z2_seconds: hrZones.z2,
    hr_z3_seconds: hrZones.z3,
    hr_z4_seconds: hrZones.z4,
    hr_z5_seconds: hrZones.z5,
    start_lat,
    start_lng,
    summary_polyline,
    points,
  };
}

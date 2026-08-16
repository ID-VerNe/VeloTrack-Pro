import { getPeriodBoundaries, type PeriodType } from '../utils/dateUtils';
import { getRiderProfile } from './riderService';

export interface PeriodicSummaryResult {
  period_type: PeriodType;
  start_time: number;
  end_time: number;
  summary: {
    total_distance_km: number;
    prev_distance_km: number;
    distance_change_pct: number;
    moving_time_seconds: number;
    elapsed_time_seconds: number;
    paused_time_seconds: number;
    moving_ratio_pct: number;
    prev_time_seconds: number;
    time_change_pct: number;
    total_ascent_meters: number;
    prev_ascent_meters: number;
    ascent_change_pct: number;
    avg_speed_kmh: number;
    moving_avg_speed_kmh: number;
    elapsed_avg_speed_kmh: number;
    prev_avg_speed_kmh: number;
    avg_speed_change_pct: number;
    max_speed_kmh: number;
    calories: number;
    rides_count: number;
    prev_rides_count: number;
    active_days_count: number;
  };
  timeline: {
    labels: string[];
    distance: number[];
    ascent: number[];
  };
  rides: Array<{
    id: string;
    title: string;
    start_time: number;
    distance_km: number;
    moving_time_seconds: number;
    elapsed_time_seconds: number;
    paused_time_seconds: number;
    moving_avg_speed_kmh: number;
    elapsed_avg_speed_kmh: number;
    avg_speed_kmh: number;
    max_speed_kmh: number;
    total_ascent_meters: number;
  }>;
}

export function estimateCyclingCalories(
  totalMovingSecs: number,
  avgSpeedKmh: number,
  totalAscentMeters: number,
  riderWeightKg = 75
): number {
  const hours = totalMovingSecs / 3600;
  let met = 5.5;
  if (avgSpeedKmh < 15) met = 5.5;
  else if (avgSpeedKmh < 19.3) met = 6.8;
  else if (avgSpeedKmh < 22.5) met = 8.0;
  else met = 10.0;

  return Math.round(met * riderWeightKg * hours + totalAscentMeters * (riderWeightKg / 65) * 0.25);
}

export async function computePeriodicSummary(
  db: D1Database,
  type: PeriodType,
  timestamp = Date.now()
): Promise<PeriodicSummaryResult> {
  const boundaries = getPeriodBoundaries(type, timestamp);
  const rider = await getRiderProfile(db);

  // Fetch rides in current period
  const currentRidesResult = await db.prepare(`
    SELECT * FROM rides
    WHERE start_time >= ? AND start_time <= ?
    ORDER BY start_time ASC
  `).bind(boundaries.currentStart, boundaries.currentEnd).all<any>();
  const currentRides = currentRidesResult.results || [];

  // Fetch rides in previous period for comparison
  const prevRidesResult = await db.prepare(`
    SELECT * FROM rides
    WHERE start_time >= ? AND start_time <= ?
    ORDER BY start_time ASC
  `).bind(boundaries.prevStart, boundaries.prevEnd).all<any>();
  const prevRides = prevRidesResult.results || [];

  // Current period aggregations
  const totalDistMeters = currentRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0);
  const totalMovingSecs = currentRides.reduce((acc, r) => acc + (r.moving_time_seconds || r.elapsed_time_seconds || 0), 0);
  const totalElapsedSecs = currentRides.reduce((acc, r) => acc + (r.elapsed_time_seconds || r.moving_time_seconds || 0), 0);
  const totalPausedSecs = Math.max(0, totalElapsedSecs - totalMovingSecs);
  const movingRatioPct = totalElapsedSecs > 0 ? Math.round((totalMovingSecs / totalElapsedSecs) * 100) : 100;

  const totalAscentMeters = currentRides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0);
  const maxSpeedKmh = currentRides.reduce((acc, r) => Math.max(acc, r.max_speed_kmh || 0), 0);

  const movingAvgSpeedKmh = totalMovingSecs > 0 ? Number(((totalDistMeters / 1000) / (totalMovingSecs / 3600)).toFixed(1)) : 0;
  const elapsedAvgSpeedKmh = totalElapsedSecs > 0 ? Number(((totalDistMeters / 1000) / (totalElapsedSecs / 3600)).toFixed(1)) : 0;

  const activeDaysSet = new Set(currentRides.map(r => new Date(r.start_time).toDateString()));

  // Previous period aggregations
  const prevDistMeters = prevRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0);
  const prevMovingSecs = prevRides.reduce((acc, r) => acc + (r.moving_time_seconds || r.elapsed_time_seconds || 0), 0);
  const prevAscentMeters = prevRides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0);
  const prevAvgSpeedKmh = prevMovingSecs > 0 ? (prevDistMeters / 1000) / (prevMovingSecs / 3600) : 0;

  // Percentage changes
  const distChangePct = prevDistMeters > 0 ? Number((((totalDistMeters - prevDistMeters) / prevDistMeters) * 100).toFixed(1)) : 0;
  const timeChangePct = prevMovingSecs > 0 ? Number((((totalMovingSecs - prevMovingSecs) / prevMovingSecs) * 100).toFixed(1)) : 0;
  const ascentChangePct = prevAscentMeters > 0 ? Number((((totalAscentMeters - prevAscentMeters) / prevAscentMeters) * 100).toFixed(1)) : 0;
  const speedChangePct = prevAvgSpeedKmh > 0 ? Number((((movingAvgSpeedKmh - prevAvgSpeedKmh) / prevAvgSpeedKmh) * 100).toFixed(1)) : 0;

  const calories = estimateCyclingCalories(totalMovingSecs, movingAvgSpeedKmh, totalAscentMeters, rider.weight_kg || 75);

  // Timeline breakdown
  const timelineLabels: string[] = [];
  const timelineDistance: number[] = [];
  const timelineAscent: number[] = [];

  if (type === 'week') {
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    for (let i = 0; i < 7; i++) {
      const dayStart = boundaries.currentStart + i * 24 * 3600 * 1000;
      const dayEnd = dayStart + 24 * 3600 * 1000 - 1;
      const dayRides = currentRides.filter(r => r.start_time >= dayStart && r.start_time <= dayEnd);
      const dayDist = dayRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0) / 1000;
      const dayAscent = dayRides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0);

      timelineLabels.push(dayNames[i]);
      timelineDistance.push(Number(dayDist.toFixed(1)));
      timelineAscent.push(dayAscent);
    }
  } else if (type === 'month') {
    for (let i = 0; i < 4; i++) {
      const wStart = boundaries.currentStart + i * 7 * 24 * 3600 * 1000;
      const wEnd = i === 3 ? boundaries.currentEnd : wStart + 7 * 24 * 3600 * 1000 - 1;
      const wRides = currentRides.filter(r => r.start_time >= wStart && r.start_time <= wEnd);
      const wDist = wRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0) / 1000;
      const wAscent = wRides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0);

      timelineLabels.push(`第 ${i + 1} 周`);
      timelineDistance.push(Number(wDist.toFixed(1)));
      timelineAscent.push(wAscent);
    }
  } else if (type === 'half_year') {
    const curDate = new Date(boundaries.currentStart);
    for (let i = 0; i < 6; i++) {
      const m = (curDate.getMonth() + i) % 12;
      const mYear = curDate.getFullYear() + Math.floor((curDate.getMonth() + i) / 12);
      const mStart = new Date(mYear, m, 1, 0, 0, 0).getTime();
      const mEnd = new Date(mYear, m + 1, 0, 23, 59, 59).getTime();

      const mRides = currentRides.filter(r => r.start_time >= mStart && r.start_time <= mEnd);
      const mDist = mRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0) / 1000;
      const mAscent = mRides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0);

      timelineLabels.push(`${m + 1}月`);
      timelineDistance.push(Number(mDist.toFixed(1)));
      timelineAscent.push(mAscent);
    }
  } else {
    const year = new Date(boundaries.currentStart).getFullYear();
    for (let m = 0; m < 12; m++) {
      const mStart = new Date(year, m, 1, 0, 0, 0).getTime();
      const mEnd = new Date(year, m + 1, 0, 23, 59, 59).getTime();

      const mRides = currentRides.filter(r => r.start_time >= mStart && r.start_time <= mEnd);
      const mDist = mRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0) / 1000;
      const mAscent = mRides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0);

      timelineLabels.push(`${m + 1}月`);
      timelineDistance.push(Number(mDist.toFixed(1)));
      timelineAscent.push(mAscent);
    }
  }

  return {
    period_type: type,
    start_time: boundaries.currentStart,
    end_time: boundaries.currentEnd,
    summary: {
      total_distance_km: Number((totalDistMeters / 1000).toFixed(1)),
      prev_distance_km: Number((prevDistMeters / 1000).toFixed(1)),
      distance_change_pct: distChangePct,
      moving_time_seconds: totalMovingSecs,
      elapsed_time_seconds: totalElapsedSecs,
      paused_time_seconds: totalPausedSecs,
      moving_ratio_pct: movingRatioPct,
      prev_time_seconds: prevMovingSecs,
      time_change_pct: timeChangePct,
      total_ascent_meters: totalAscentMeters,
      prev_ascent_meters: prevAscentMeters,
      ascent_change_pct: ascentChangePct,
      avg_speed_kmh: movingAvgSpeedKmh,
      moving_avg_speed_kmh: movingAvgSpeedKmh,
      elapsed_avg_speed_kmh: elapsedAvgSpeedKmh,
      prev_avg_speed_kmh: Number(prevAvgSpeedKmh.toFixed(1)),
      avg_speed_change_pct: speedChangePct,
      max_speed_kmh: Number(maxSpeedKmh.toFixed(1)),
      calories,
      rides_count: currentRides.length,
      prev_rides_count: prevRides.length,
      active_days_count: activeDaysSet.size,
    },
    timeline: {
      labels: timelineLabels,
      distance: timelineDistance,
      ascent: timelineAscent,
    },
    rides: currentRides.map(r => {
      const mSec = r.moving_time_seconds || r.elapsed_time_seconds || 0;
      const eSec = r.elapsed_time_seconds || r.moving_time_seconds || 0;
      const dKm = (r.distance_meters || 0) / 1000;
      const mSpd = mSec > 0 ? Number((dKm / (mSec / 3600)).toFixed(1)) : 0;
      const eSpd = eSec > 0 ? Number((dKm / (eSec / 3600)).toFixed(1)) : 0;

      return {
        id: r.id,
        title: r.title,
        start_time: r.start_time,
        distance_km: Number(dKm.toFixed(1)),
        moving_time_seconds: mSec,
        elapsed_time_seconds: eSec,
        paused_time_seconds: Math.max(0, eSec - mSec),
        moving_avg_speed_kmh: mSpd,
        elapsed_avg_speed_kmh: eSpd,
        avg_speed_kmh: mSpd,
        max_speed_kmh: r.max_speed_kmh || 0,
        total_ascent_meters: r.total_ascent_meters || 0,
      };
    }),
  };
}

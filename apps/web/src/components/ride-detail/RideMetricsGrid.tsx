import React from 'react';
import BentoMetricCard from '../common/BentoMetricCard';
import { formatFriendlyDuration, calculateDualSpeeds } from '../../utils/cyclingCalculations';

interface Props {
  ride: any;
  calories: number;
}

export default function RideMetricsGrid({ ride, calories }: Props) {
  const {
    movingAvgSpeedKmh,
    elapsedAvgSpeedKmh,
    movingTimeSeconds,
    elapsedTimeSeconds,
    pausedTimeSeconds,
    movingRatioPct,
  } = calculateDualSpeeds(
    ride?.distance_meters || 0,
    ride?.moving_time_seconds,
    ride?.elapsed_time_seconds
  );

  const movingDurationFriendly = formatFriendlyDuration(movingTimeSeconds);
  const elapsedDurationFriendly = formatFriendlyDuration(elapsedTimeSeconds);
  const pausedMins = Number((pausedTimeSeconds / 60).toFixed(1));
  const pausedRatio = 100 - movingRatioPct;
  const distanceKm = ((ride?.distance_meters || 0) / 1000).toFixed(2);

  return (
    <div className="grid grid-cols-2 gap-3">
      <BentoMetricCard
        label="骑行总里程"
        value={distanceKm}
        unit="公里"
        subLabel={`总历时 ${elapsedDurationFriendly} · 踩踏做功 ${movingDurationFriendly}`}
      />
      <BentoMetricCard
        label="停表均速"
        value={movingAvgSpeedKmh}
        unit="km/h"
        subLabel={`仅计踩踏做功阶段 · 最高 ${ride?.max_speed_kmh || 0} km/h`}
      />
      <BentoMetricCard
        label="总均速"
        value={elapsedAvgSpeedKmh}
        unit="km/h"
        subLabel={`含停顿全历时 · 停顿 ${pausedMins}分 (${pausedRatio}%)`}
      />
      <BentoMetricCard
        label="累计爬升 / 能量"
        value={ride?.total_ascent_meters || 0}
        unit="米"
        subLabel={`最高海拔 ${ride?.max_altitude_meters || 0}m · 消耗 ${calories}kcal`}
      />
    </div>
  );
}

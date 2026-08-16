import React from 'react';
import BentoMetricCard from '../common/BentoMetricCard';
import { formatDuration, calculateDualSpeeds } from '../../utils/cyclingCalculations';

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

  const movingDurationFormatted = formatDuration(movingTimeSeconds);
  const pausedMins = Math.round(pausedTimeSeconds / 60);
  const distanceKm = ((ride?.distance_meters || 0) / 1000).toFixed(2);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
      <BentoMetricCard
        label="骑行总里程"
        value={distanceKm}
        unit="公里"
        subLabel={`运动 ${movingDurationFormatted}${pausedMins > 0 ? ` · 停顿 ${pausedMins}分` : ''}`}
      />
      <BentoMetricCard
        label="⚡ 停表骑行均速"
        value={movingAvgSpeedKmh}
        unit="km/h"
        subLabel={`最高冲刺 ${ride?.max_speed_kmh || 0} km/h`}
      />
      <BentoMetricCard
        label="🌐 综合总均速"
        value={elapsedAvgSpeedKmh}
        unit="km/h"
        subLabel={`门到门耗时 · 做功占比 ${movingRatioPct}%`}
      />
      <BentoMetricCard
        label="累计爬升 / 能量"
        value={ride?.total_ascent_meters || 0}
        unit="米"
        subLabel={`最高 ${ride?.max_altitude_meters || 0}m · 消耗 ${calories}kcal`}
      />
    </div>
  );
}

import React from 'react';
import BentoMetricCard from '../common/BentoMetricCard';
import { formatFriendlyDuration, calculateDualSpeeds } from '../../utils/cyclingCalculations';
import { CruisingAnalysisResult, analyzeSpeedDistribution } from '../../utils/speedDistribution';

interface Props {
  ride: any;
  calories: number;
  speedDistribution?: CruisingAnalysisResult | null;
}

export default function RideMetricsGrid({ ride, calories, speedDistribution }: Props) {
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

  // 若未直接传入 speedDistribution，则自动计算平稳经验兜底值
  const speedDist = speedDistribution || analyzeSpeedDistribution(null, movingAvgSpeedKmh, 46, 15);

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
      {/* 1. 总里程 */}
      <BentoMetricCard
        label="骑行总里程"
        value={distanceKm}
        unit="公里"
        subLabel={`总历时 ${elapsedDurationFriendly} · 踩踏做功 ${movingDurationFriendly}`}
      />

      {/* 2. 稳态平路巡航 (新算法提取) */}
      <BentoMetricCard
        label="稳态平路巡航"
        value={speedDist.cruising_avg_speed_kmh}
        unit="km/h"
        subLabel={
          <div className="flex flex-wrap items-center gap-1.5">
            <span>46/15T 踏频 ~{speedDist.derived_cadence_rpm} rpm</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${
                speedDist.cadence_zone_status === 'golden'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              {speedDist.cadence_zone_status === 'golden' ? '85-95rpm 黄金区间' : '巡航档位'}
            </span>
          </div>
        }
      />

      {/* 3. 停表均速 (含速度损耗) */}
      <BentoMetricCard
        label="停表均速"
        value={movingAvgSpeedKmh}
        unit="km/h"
        subLabel={`纯踩踏做功 · 速度损耗 -${speedDist.speed_loss_kmh}km/h (${speedDist.speed_loss_pct}%)`}
      />

      {/* 4. 总均速 */}
      <BentoMetricCard
        label="总均速"
        value={elapsedAvgSpeedKmh}
        unit="km/h"
        subLabel={`含停顿全历时 · 停顿 ${pausedMins}分 (${pausedRatio}%)`}
      />

      {/* 5. 累计爬升 / 能量 */}
      <BentoMetricCard
        label="累计爬升 / 能量"
        value={ride?.total_ascent_meters || 0}
        unit="米"
        subLabel={`最高海拔 ${ride?.max_altitude_meters || 0}m · 消耗 ${calories}kcal`}
      />

      {/* 6. 持续稳态巡航段落 (算法 3 提取) */}
      <BentoMetricCard
        label="持续稳态巡航"
        value={speedDist.sustained_segments_count}
        unit="段"
        subLabel={`连续维持 ≥20s · 稳态均速 ${speedDist.sustained_avg_speed_kmh} km/h`}
      />
    </div>
  );
}

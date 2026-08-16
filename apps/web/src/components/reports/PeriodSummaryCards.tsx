import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Bike, 
  Clock, 
  Mountain, 
  Zap, 
  Flame 
} from 'lucide-react';
import { formatDuration } from '../../utils/cyclingCalculations';

interface Props {
  summary: any;
}

export default function PeriodSummaryCards({ summary }: Props) {
  if (!summary) return null;

  const movingDurationStr = formatDuration(summary.moving_time_seconds || 0);
  const pausedMins = Math.round((summary.paused_time_seconds || 0) / 60);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. 里程 */}
      <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100/80 shadow-2xs">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-1.5">
          <div className="flex items-center space-x-1.5">
            <Bike className="w-3.5 h-3.5 text-blue-600" />
            <span>周期总里程</span>
          </div>
          {summary.distance_change_pct !== 0 && (
            <span
              className={`flex items-center text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                summary.distance_change_pct > 0
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              {summary.distance_change_pct > 0 ? (
                <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" />
              ) : (
                <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" />
              )}
              {Math.abs(summary.distance_change_pct)}%
            </span>
          )}
        </div>
        <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{summary.total_distance_km}</span>
          <span className="text-xs font-semibold text-slate-400 ml-1">公里</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1 font-medium">
          上周期: {summary.prev_distance_km} km · 完成 {summary.rides_count || 0} 次
        </div>
      </div>

      {/* 2. 运动做功时间 */}
      <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100/80 shadow-2xs">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-1.5">
          <div className="flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span>纯运动做功时间</span>
          </div>
          {summary.moving_ratio_pct && (
            <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded-md">
              做功占比 {summary.moving_ratio_pct}%
            </span>
          )}
        </div>
        <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{movingDurationStr}</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1 font-medium">
          {pausedMins > 0 ? `红绿灯/停顿耗时: ${pausedMins} 分钟` : `无明显停顿延误`}
        </div>
      </div>

      {/* 3. 停表均速 vs 总均速 */}
      <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100/80 shadow-2xs">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-1.5">
          <div className="flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>⚡ 停表骑行均速</span>
          </div>
          {summary.avg_speed_change_pct !== 0 && (
            <span
              className={`flex items-center text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                summary.avg_speed_change_pct > 0
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-600'
              }`}
            >
              {summary.avg_speed_change_pct > 0 ? (
                <ArrowUpRight className="w-2.5 h-2.5 mr-0.5" />
              ) : (
                <ArrowDownRight className="w-2.5 h-2.5 mr-0.5" />
              )}
              {Math.abs(summary.avg_speed_change_pct)}%
            </span>
          )}
        </div>
        <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{summary.moving_avg_speed_kmh || summary.avg_speed_kmh}</span>
          <span className="text-xs font-semibold text-slate-400 ml-1">km/h</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1 font-medium flex items-center justify-between">
          <span>综合总均速: {summary.elapsed_avg_speed_kmh || summary.avg_speed_kmh} km/h</span>
          <span>极速: {summary.max_speed_kmh} km/h</span>
        </div>
      </div>

      {/* 4. 累计爬升 */}
      <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100/80 shadow-2xs">
        <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-1.5">
          <div className="flex items-center space-x-1.5">
            <Mountain className="w-3.5 h-3.5 text-emerald-600" />
            <span>累计爬升做功</span>
          </div>
          <div className="flex items-center space-x-1 text-[10px] font-bold text-orange-600">
            <Flame className="w-3 h-3 text-orange-500" />
            <span>{summary.calories} kcal</span>
          </div>
        </div>
        <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{summary.total_ascent_meters}</span>
          <span className="text-xs font-semibold text-slate-400 ml-1">米</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-1 font-medium">
          上周期爬升: {summary.prev_ascent_meters} m
        </div>
      </div>
    </div>
  );
}

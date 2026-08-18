import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight
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
      <div className="bg-white rounded-lg p-5 border border-slate-200/80 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
          <span>周期总里程</span>
          {summary.distance_change_pct !== 0 && (
            <span
              className={`flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded ${
                summary.distance_change_pct > 0
                  ? 'bg-slate-50 text-emerald-700 border border-slate-200'
                  : 'bg-slate-50 text-rose-600 border border-slate-200'
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
        <div className="text-2xl font-semibold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{summary.total_distance_km}</span>
          <span className="text-xs font-normal text-slate-400 ml-1 font-sans">公里</span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono">
          上周期: {summary.prev_distance_km} km · 完成 {summary.rides_count || 0} 次
        </div>
      </div>

      {/* 2. 运动做功时间 */}
      <div className="bg-white rounded-lg p-5 border border-slate-200/80 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
          <span>纯运动做功时间</span>
          {summary.moving_ratio_pct && (
            <span className="text-[10px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
              做功占比 {summary.moving_ratio_pct}%
            </span>
          )}
        </div>
        <div className="text-2xl font-semibold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{movingDurationStr}</span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono">
          {pausedMins > 0 ? `红绿灯/停顿耗时: ${pausedMins} 分钟` : `无明显停顿延误`}
        </div>
      </div>

      {/* 3. 停表均速 vs 总均速 */}
      <div className="bg-white rounded-lg p-5 border border-slate-200/80 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
          <span>停表均速</span>
          {summary.avg_speed_change_pct !== 0 && (
            <span
              className={`flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded ${
                summary.avg_speed_change_pct > 0
                  ? 'bg-slate-50 text-emerald-700 border border-slate-200'
                  : 'bg-slate-50 text-rose-600 border border-slate-200'
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
        <div className="text-2xl font-semibold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{summary.moving_avg_speed_kmh || summary.avg_speed_kmh}</span>
          <span className="text-xs font-normal text-slate-400 ml-1 font-sans">km/h</span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between">
          <span>总均速: {summary.elapsed_avg_speed_kmh || summary.avg_speed_kmh} km/h</span>
          <span>极速: {summary.max_speed_kmh} km/h</span>
        </div>
      </div>

      {/* 4. 累计爬升 */}
      <div className="bg-white rounded-lg p-5 border border-slate-200/80 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
          <span>累计爬升做功</span>
          <div className="text-[10px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
            <span>{summary.calories} kcal</span>
          </div>
        </div>
        <div className="text-2xl font-semibold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{summary.total_ascent_meters}</span>
          <span className="text-xs font-normal text-slate-400 ml-1 font-sans">米</span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono">
          上周期爬升: {summary.prev_ascent_meters} m
        </div>
      </div>
    </div>
  );
}

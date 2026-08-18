import React from 'react';

interface Props {
  targets: {
    weeklyDistanceKm: number;
    targetAvgSpeedKmh: number;
    monthlyDistanceKm: number;
    annualDistanceKm: number;
  };
  realStats: {
    thisWeekDistanceKm: number;
    bestAvgSpeedKmh: number;
    thisMonthDistanceKm: number;
    totalDistanceKm: number;
  };
}

export default function GoalTargetCards({ targets, realStats }: Props) {
  const weeklyPct = Math.round(
    (realStats.thisWeekDistanceKm / (targets.weeklyDistanceKm || 50)) * 100
  );
  const speedPct = Math.round(
    (realStats.bestAvgSpeedKmh / (targets.targetAvgSpeedKmh || 20)) * 100
  );
  const monthlyPct = Math.round(
    (realStats.thisMonthDistanceKm / (targets.monthlyDistanceKm || 150)) * 100
  );
  const annualPct = Math.round(
    (realStats.totalDistanceKm / (targets.annualDistanceKm || 1000)) * 100
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. 本周里程目标 */}
      <div className="bg-white rounded-lg p-5 border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
          <span>单周里程目标</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">
            {weeklyPct}%
          </span>
        </div>

        <div className="text-2xl font-semibold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{realStats.thisWeekDistanceKm}</span>
          <span className="text-xs font-normal text-slate-400 ml-1 font-sans">
            / {targets.weeklyDistanceKm} km
          </span>
        </div>

        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-slate-900 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, weeklyPct)}%` }}
          />
        </div>
      </div>

      {/* 2. 目标巡航均速 */}
      <div className="bg-white rounded-lg p-5 border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
          <span>目标巡航均速</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">
            达成 {speedPct}%
          </span>
        </div>

        <div className="text-2xl font-semibold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{realStats.bestAvgSpeedKmh}</span>
          <span className="text-xs font-normal text-slate-400 ml-1 font-sans">
            / {targets.targetAvgSpeedKmh} km/h
          </span>
        </div>

        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-slate-900 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, speedPct)}%` }}
          />
        </div>
      </div>

      {/* 3. 本月目标里程 */}
      <div className="bg-white rounded-lg p-5 border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
          <span>月度总跑量</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">
            {monthlyPct}%
          </span>
        </div>

        <div className="text-2xl font-semibold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{realStats.thisMonthDistanceKm}</span>
          <span className="text-xs font-normal text-slate-400 ml-1 font-sans">
            / {targets.monthlyDistanceKm} km
          </span>
        </div>

        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-slate-900 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, monthlyPct)}%` }}
          />
        </div>
      </div>

      {/* 4. 年度目标里程 */}
      <div className="bg-white rounded-lg p-5 border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
          <span>年度累计里程</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">
            {annualPct}%
          </span>
        </div>

        <div className="text-2xl font-semibold font-mono text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{realStats.totalDistanceKm}</span>
          <span className="text-xs font-normal text-slate-400 ml-1 font-sans">
            / {targets.annualDistanceKm} km
          </span>
        </div>

        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-slate-900 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, annualPct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Target, TrendingUp, Calendar, Trophy } from 'lucide-react';

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
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
          <div className="flex items-center space-x-1.5">
            <Target className="w-3.5 h-3.5 text-slate-900" />
            <span className="text-slate-700">单周里程目标</span>
          </div>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono">
            {weeklyPct}%
          </span>
        </div>

        <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{realStats.thisWeekDistanceKm}</span>
          <span className="text-xs font-semibold text-slate-400 ml-1">
            / {targets.weeklyDistanceKm} km
          </span>
        </div>

        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-slate-900 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, weeklyPct)}%` }}
          />
        </div>
      </div>

      {/* 2. 目标巡航均速 */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
          <div className="flex items-center space-x-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
            <span className="text-slate-700">目标巡航均速</span>
          </div>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-800 font-mono">
            达成 {speedPct}%
          </span>
        </div>

        <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{realStats.bestAvgSpeedKmh}</span>
          <span className="text-xs font-semibold text-slate-400 ml-1">
            / {targets.targetAvgSpeedKmh} km/h
          </span>
        </div>

        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-sky-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, speedPct)}%` }}
          />
        </div>
      </div>

      {/* 3. 本月目标里程 */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
          <div className="flex items-center space-x-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-slate-700">月度总跑量</span>
          </div>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-mono">
            {monthlyPct}%
          </span>
        </div>

        <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{realStats.thisMonthDistanceKm}</span>
          <span className="text-xs font-semibold text-slate-400 ml-1">
            / {targets.monthlyDistanceKm} km
          </span>
        </div>

        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, monthlyPct)}%` }}
          />
        </div>
      </div>

      {/* 4. 年度目标里程 */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
          <div className="flex items-center space-x-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-slate-700">年度累计里程</span>
          </div>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 font-mono">
            {annualPct}%
          </span>
        </div>

        <div className="text-2xl font-black text-slate-900 tracking-tight tabular-nums flex items-baseline">
          <span>{realStats.totalDistanceKm}</span>
          <span className="text-xs font-semibold text-slate-400 ml-1">
            / {targets.annualDistanceKm} km
          </span>
        </div>

        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
          <div
            className="bg-amber-600 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, annualPct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

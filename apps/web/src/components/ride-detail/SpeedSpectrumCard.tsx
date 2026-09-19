import React from 'react';
import { SpeedTierBreakdown } from '../../utils/speedDistribution';

interface Props {
  tiers: SpeedTierBreakdown;
  totalDurationSeconds?: number;
  className?: string;
}

interface TierConfig {
  key: keyof SpeedTierBreakdown;
  label: string;
  speedRange: string;
  colorClass: string;
  bgHex: string;
  pctKey: keyof SpeedTierBreakdown;
}

const TIER_CONFIGS: TierConfig[] = [
  {
    key: 'paused_secs',
    pctKey: 'paused_pct',
    label: '停顿等待',
    speedRange: '<2 km/h',
    colorClass: 'bg-slate-400',
    bgHex: '#94A3B8',
  },
  {
    key: 'low_speed_secs',
    pctKey: 'low_speed_pct',
    label: '起步/控车',
    speedRange: '2-15 km/h',
    colorClass: 'bg-amber-500',
    bgHex: '#F59E0B',
  },
  {
    key: 'tempo_secs',
    pctKey: 'tempo_pct',
    label: '节奏过渡',
    speedRange: '15-22 km/h',
    colorClass: 'bg-sky-400',
    bgHex: '#38BDF8',
  },
  {
    key: 'cruising_secs',
    pctKey: 'cruising_pct',
    label: '稳态巡航',
    speedRange: '22-30 km/h',
    colorClass: 'bg-emerald-500',
    bgHex: '#10B981',
  },
  {
    key: 'sprint_secs',
    pctKey: 'sprint_pct',
    label: '冲刺极速',
    speedRange: '≥30 km/h',
    colorClass: 'bg-violet-500',
    bgHex: '#8B5CF6',
  },
];

export default function SpeedSpectrumCard({ tiers, totalDurationSeconds = 0, className = '' }: Props) {
  // 格式化秒数为分钟
  const formatMins = (secs: number) => {
    if (secs <= 0) return '0分';
    const mins = Math.round(secs / 60);
    return mins > 0 ? `${mins}分钟` : '<1分钟';
  };

  return (
    <div className={`p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h4 className="text-xs font-semibold text-slate-800 tracking-tight">速度时间谱系与区间做功分布</h4>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          全历时耗时分段
        </span>
      </div>

      {/* Proportional Segmented Progress Bar with dividers to eliminate Mach band bleeding */}
      <div
        className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100 gap-[1.5px] p-[1px] border border-slate-200/70"
        role="progressbar"
        aria-label="速度时间分段比例"
      >
        {TIER_CONFIGS.map((tier) => {
          const pct = Number(tiers[tier.pctKey]) || 0;
          if (pct <= 0) return null;
          return (
            <div
              key={tier.key}
              style={{ width: `${pct}%` }}
              className={`${tier.colorClass} h-full first:rounded-l-full last:rounded-r-full transition-all duration-500 hover:brightness-110 cursor-pointer relative group`}
              title={`${tier.label} (${tier.speedRange}): ${pct}%`}
            />
          );
        })}
      </div>

      {/* Legend & Stat Capsules */}
      <div className="grid grid-cols-5 gap-1.5 mt-3 pt-2 border-t border-slate-200/60">
        {TIER_CONFIGS.map((tier) => {
          const pct = Number(tiers[tier.pctKey]) || 0;
          const rawSecs = Number(tiers[tier.key]) || 0;
          const secs = totalDurationSeconds > 0 ? Math.round(totalDurationSeconds * (pct / 100)) : rawSecs;
          const isCruise = tier.key === 'cruising_secs';

          return (
            <div
              key={tier.key}
              className={`flex flex-col items-center text-center p-1.5 rounded-md transition-colors ${
                isCruise ? 'bg-emerald-50/80 border border-emerald-200/60' : ''
              }`}
            >
              <div className="flex items-center space-x-1 mb-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${tier.colorClass}`} />
                <span className={`text-[10px] truncate ${isCruise ? 'font-semibold text-emerald-900' : 'text-slate-600'}`}>
                  {tier.label}
                </span>
              </div>
              <span className={`text-xs font-bold font-mono tabular-nums leading-none ${isCruise ? 'text-emerald-700' : 'text-slate-800'}`}>
                {pct}%
              </span>
              <span className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-tight antialiased">
                {tier.speedRange}
              </span>
              {secs > 0 && (
                <span className="text-[10px] text-slate-500 font-mono font-medium tracking-tight antialiased mt-0.5">
                  {formatMins(secs)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

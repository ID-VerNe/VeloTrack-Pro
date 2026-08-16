import React from 'react';

interface Props {
  value: string | number;
  unit?: string;
  label: string;
  subLabel?: string;
  className?: string;
}

export default function BentoMetricCard({ value, unit, label, subLabel, className = '' }: Props) {
  return (
    <div className={`bg-white rounded-xl p-3.5 border border-slate-200/90 shadow-card ${className}`}>
      <div className="text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
        {value} {unit && <span className="text-xs font-normal text-slate-500">{unit}</span>}
      </div>
      <div className="text-xs text-slate-400 font-medium mt-1">
        {label} {subLabel && <span className="text-[10px] text-slate-300">/ {subLabel}</span>}
      </div>
    </div>
  );
}

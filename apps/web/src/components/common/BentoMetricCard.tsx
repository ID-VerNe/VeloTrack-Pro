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
    <div className={`bg-white rounded-lg p-5 border border-slate-200/80 flex flex-col justify-between transition-colors ${className}`}>
      <div className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
        {label}
      </div>
      
      <div className="my-2 flex items-baseline gap-1 text-2xl font-semibold font-mono text-slate-900 tabular-nums">
        <span>{value}</span>
        {unit && (
          <span className="text-xs font-normal text-slate-400 whitespace-nowrap font-sans">
            {unit}
          </span>
        )}
      </div>

      {subLabel && (
        <div className="text-[11px] text-slate-400 font-mono leading-relaxed mt-0.5">
          {subLabel}
        </div>
      )}
    </div>
  );
}

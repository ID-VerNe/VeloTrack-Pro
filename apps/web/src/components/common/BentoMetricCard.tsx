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
    <div className={`bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex flex-col justify-between hover:border-slate-300 transition-all ${className}`}>
      <div className="text-[11px] font-bold text-slate-500 tracking-tight">
        {label}
      </div>
      
      <div className="my-1.5 flex items-baseline gap-1 text-2xl font-black text-slate-900 tabular-nums">
        <span>{value}</span>
        {unit && (
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
            {unit}
          </span>
        )}
      </div>

      {subLabel && (
        <div className="text-[10.5px] text-slate-400 font-medium leading-relaxed mt-0.5">
          {subLabel}
        </div>
      )}
    </div>
  );
}

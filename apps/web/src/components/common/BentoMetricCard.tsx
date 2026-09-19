import React from 'react';

interface Props {
  value: string | number;
  unit?: string;
  label: string;
  subLabel?: string | React.ReactNode;
  className?: string;
}

export default function BentoMetricCard({ value, unit, label, subLabel, className = '' }: Props) {
  return (
    <div className={`flex flex-col justify-start py-2 ${className}`}>
      <div className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </div>
      
      <div className="flex items-baseline gap-1.5 text-[26px] sm:text-[28px] font-semibold text-slate-900 leading-none tabular-nums font-mono">
        <span>{value}</span>
        {unit && (
          <span className="text-[12px] font-normal text-slate-400 whitespace-nowrap font-sans translate-y-[-0.5px]">
            {unit}
          </span>
        )}
      </div>

      {subLabel && (
        <div className="text-[12px] text-slate-500 leading-snug mt-1.5 font-sans">
          {subLabel}
        </div>
      )}
    </div>
  );
}

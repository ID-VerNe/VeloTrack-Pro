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
      <div className="text-[11px] font-medium text-black/44 uppercase tracking-wider mb-1">
        {label}
      </div>
      
      <div className="flex items-baseline gap-1.5 text-[28px] font-medium text-black leading-none tabular-nums">
        <span>{value}</span>
        {unit && (
          <span className="text-[13px] font-normal text-black/64 whitespace-nowrap">
            {unit}
          </span>
        )}
      </div>

      {subLabel && (
        <div className="text-[12px] text-black/64 leading-snug mt-2">
          {subLabel}
        </div>
      )}
    </div>
  );
}

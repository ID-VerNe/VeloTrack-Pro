import React from 'react';

interface Props {
  className?: string;
}

export default function SpeedGradientLegend({ className = '' }: Props) {
  return (
    <div
      data-testid="speed-gradient-legend"
      className={`bg-white/95 backdrop-blur px-4 py-2.5 rounded-lg border border-slate-200/80 flex items-center space-x-4 font-sans shadow-md ${className}`}
    >
      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">速度谱系:</span>

      <div className="flex items-center space-x-4 text-[12px]">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
          <span className="text-slate-600">停顿/低速</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
          <span className="text-slate-600">起步/爬坡</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-emerald-700 font-medium">巡航区间</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
          <span className="text-rose-600 font-medium">高速冲刺</span>
        </div>
      </div>
    </div>
  );
}

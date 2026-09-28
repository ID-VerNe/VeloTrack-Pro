import React from 'react';

interface Props {
  rides: any[];
  scopeLabel?: string;
}

export default function TotalStatsCard({ rides, scopeLabel }: Props) {
  const totalDistMeters = rides.reduce((acc, r) => acc + (r.distance_meters || 0), 0);
  const dynamicDistance = totalDistMeters / 1000;
  
  const movingSeconds = rides.reduce((acc, r) => acc + (r.moving_time_seconds || r.elapsed_time_seconds || 0), 0);
  const elapsedSeconds = rides.reduce((acc, r) => acc + (r.elapsed_time_seconds || r.moving_time_seconds || 0), 0);
  const dynamicHours = Number((movingSeconds / 3600).toFixed(1));

  const overallMovingAvgSpeed = movingSeconds > 0 ? Number(((totalDistMeters / 1000) / (movingSeconds / 3600)).toFixed(1)) : 0;
  const overallElapsedAvgSpeed = elapsedSeconds > 0 ? Number(((totalDistMeters / 1000) / (elapsedSeconds / 3600)).toFixed(1)) : 0;

  const displayDistance = dynamicDistance >= 1000 
    ? dynamicDistance.toLocaleString('zh-CN', { maximumFractionDigits: 0 }) 
    : dynamicDistance.toFixed(1);

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-6 space-y-6">
      {/* Primary Telemetry Header */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-5">
        <div>
          <div className="flex items-center space-x-1.5 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
            <span>累计遥测总里程</span>
            {scopeLabel && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-brand-50 text-brand-600 border border-brand-200/60 font-semibold normal-case">
                {scopeLabel}
              </span>
            )}
          </div>

          <div className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-[-0.03em] mt-1 font-mono tabular-nums flex items-baseline">
            <span>{displayDistance}</span>
            <span className="text-xs font-normal ml-1 text-slate-400 font-sans -translate-y-[0.5px]">公里</span>
          </div>
        </div>

        <div className="text-right space-y-1">
          <div className="text-xs font-mono font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200/60 inline-block tabular-nums">
            停表均速 {overallMovingAvgSpeed} km/h
          </div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
            总均速 {overallElapsedAvgSpeed} km/h
          </div>
        </div>
      </div>

      {/* Sub-metrics Hairline Grid */}
      <div className="grid grid-cols-2 divide-x divide-slate-100">
        {/* Total Rides */}
        <div className="pr-4 space-y-0.5">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">总记录骑行</div>
          <div className="text-base font-semibold text-slate-900 font-mono tabular-nums">
            {rides.length} <span className="text-xs font-normal text-slate-400 font-sans">次</span>
          </div>
        </div>

        {/* Total Time */}
        <div className="pl-4 space-y-0.5">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">纯踩踏做功用时</div>
          <div className="text-base font-semibold text-slate-900 font-mono tabular-nums">
            {dynamicHours} <span className="text-xs font-normal text-slate-400 font-sans">小时</span>
          </div>
        </div>
      </div>
    </div>
  );
}

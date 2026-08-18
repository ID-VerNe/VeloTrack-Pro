import React from 'react';
import { Bike, Clock } from 'lucide-react';

interface Props {
  rides: any[];
}

export default function TotalStatsCard({ rides }: Props) {
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
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
            累计遥测总里程
          </div>

          <div className="text-4xl font-black text-slate-900 tracking-tight mt-1 tabular-nums flex items-baseline">
            <span>{displayDistance}</span>
            <span className="text-base font-bold ml-1.5 text-slate-500 font-sans">公里</span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            停表均速 {overallMovingAvgSpeed} km/h
          </span>
          <div className="text-xs text-slate-500 font-medium mt-1">
            总均速 {overallElapsedAvgSpeed} km/h
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
        {/* Total Rides */}
        <div className="flex items-center space-x-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Bike className="w-4 h-4 text-sky-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-900 leading-tight tabular-nums">
              {rides.length} <span className="text-xs font-normal text-slate-500">次</span>
            </div>
            <div className="text-xs text-slate-500 font-medium truncate">总记录骑行</div>
          </div>
        </div>

        {/* Total Time */}
        <div className="flex items-center space-x-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black text-slate-900 leading-tight tabular-nums">
              {dynamicHours} <span className="text-xs font-normal text-slate-500">小时</span>
            </div>
            <div className="text-xs text-slate-500 font-medium truncate">纯踩踏做功用时</div>
          </div>
        </div>
      </div>
    </div>
  );
}

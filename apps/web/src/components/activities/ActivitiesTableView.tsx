// apps/web/src/components/activities/ActivitiesTableView.tsx
//
// 骑行档案高密度结构化表格视图组件
// 遵循单一职责（SRP）原则，独立封装列头排列、数值格式化、城市角标、行点击及删除操作入口。

import React from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import { formatDuration, formatRideDate } from '../../utils/cyclingCalculations';
import { detectCityForRide } from '../../utils/geoUtils';

interface Props {
  rides: any[];
  onRideClick: (rideId: string) => void;
  onDeleteRequest: (e: React.MouseEvent, rideId: string, title: string) => void;
  deletingId?: string | null;
}

export default function ActivitiesTableView({
  rides,
  onRideClick,
  onDeleteRequest,
  deletingId = null,
}: Props) {
  return (
    <div data-testid="activities-table-view" className="bg-white rounded-lg border border-slate-200/80 overflow-hidden">
      {/* Header row */}
      <div className="px-5 py-2.5 bg-slate-50/50 border-b border-slate-200/80 flex items-center justify-between text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
        <div className="flex items-center space-x-4 flex-1 min-w-0">
          <div className="flex-1 min-w-0">骑行名称与日期</div>
        </div>
        <div className="flex items-center space-x-6 text-right tabular-nums">
          <div className="w-20">距离</div>
          <div className="w-20 hidden sm:block">停表均速</div>
          <div className="w-20 hidden md:block">累计爬升</div>
          <div className="w-20">运动耗时</div>
          <div className="w-6 text-center">进入</div>
        </div>
      </div>

      {/* Data rows */}
      <div className="divide-y divide-slate-100">
        {rides.map((ride) => {
          const distKm = ((ride.distance_meters || 0) / 1000).toFixed(1);
          const duration = formatDuration(ride.moving_time_seconds || ride.elapsed_time_seconds || 0);
          const city = detectCityForRide(ride);
          const dateStr = formatRideDate(ride.start_time);

          return (
            <div
              key={ride.id}
              data-testid={`activity-row-${ride.id}`}
              onClick={() => onRideClick(ride.id)}
              className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer"
            >
              <div className="min-w-0 flex-1 pr-3">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-medium text-slate-900 group-hover:text-slate-950 transition-colors truncate">
                    {ride.title}
                  </span>
                  <span className="text-[10px] font-mono bg-slate-50 text-slate-500 border border-slate-200 px-1.5 py-0.2 rounded shrink-0">
                    {city}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  {dateStr}
                </div>
              </div>

              <div className="flex items-center space-x-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                <div className="w-16 font-semibold text-slate-900">
                  {distKm} <span className="text-[10px] text-slate-400 font-normal font-sans">km</span>
                </div>
                <div className="w-16 hidden sm:block">
                  {ride.avg_speed_kmh ? ride.avg_speed_kmh.toFixed(1) : '-'} <span className="text-[10px] text-slate-400 font-normal font-sans">km/h</span>
                </div>
                <div className="w-16 hidden md:block">
                  {ride.total_ascent_meters ? Math.round(ride.total_ascent_meters) : 0} <span className="text-[10px] text-slate-400 font-normal font-sans">m</span>
                </div>
                <div className="w-16 text-slate-500">{duration}</div>
                <button
                  type="button"
                  onClick={(e) => onDeleteRequest(e, ride.id, ride.title)}
                  disabled={deletingId === ride.id}
                  className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  aria-label="删除此记录"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <div className="w-5 text-center text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all">
                  <ChevronRight className="w-3.5 h-3.5 inline-block" aria-hidden="true" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

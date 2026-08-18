import React from 'react';
import { Link } from 'react-router-dom';
import { formatDuration } from '../../utils/cyclingCalculations';

interface Props {
  rides: Array<{
    id: string;
    title: string;
    start_time: number;
    distance_km: number;
    moving_time_seconds?: number;
    elapsed_time_seconds?: number;
    duration_seconds?: number;
    moving_avg_speed_kmh?: number;
    elapsed_avg_speed_kmh?: number;
    avg_speed_kmh: number;
    max_speed_kmh: number;
    total_ascent_meters: number;
  }>;
}

export default function PeriodRidesTable({ rides }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          本周期骑行记录 ({rides.length})
        </h3>
        <span className="text-xs text-slate-500 font-medium">点击骑行卡片可进入详情</span>
      </div>

      {rides.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {rides.map((ride) => {
            const movingSec = ride.moving_time_seconds || ride.duration_seconds || 0;
            const movingSpeed = ride.moving_avg_speed_kmh || ride.avg_speed_kmh;
            const elapsedSpeed = ride.elapsed_avg_speed_kmh;

            return (
              <Link
                key={ride.id}
                to={`/ride/${ride.id}`}
                state={{ from: '/reports' }}
                className="p-4 bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-100/80 hover:border-blue-300 hover:shadow-md transition-all group block"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-xs text-slate-900 group-hover:text-blue-600 transition-colors truncate max-w-[200px]">
                    {ride.title}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    {new Date(ride.start_time).toLocaleDateString('zh-CN', {
                      month: 'numeric',
                      day: 'numeric',
                    })}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-100">
                  <div>
                    <div className="text-xs text-slate-500 font-medium">里程</div>
                    <div className="font-extrabold text-slate-900 tabular-nums">
                      {ride.distance_km} km
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">运动做功</div>
                    <div className="font-extrabold text-slate-900 tabular-nums">
                      {formatDuration(movingSec)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-medium">停表均速</div>
                    <div className="font-extrabold text-slate-900 tabular-nums">
                      {movingSpeed} <span className="text-2xs font-normal text-slate-500">km/h</span>
                    </div>
                    {elapsedSpeed && elapsedSpeed !== movingSpeed && (
                      <div className="text-2xs text-slate-500 font-medium truncate">
                        总均速 {elapsedSpeed}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center text-slate-500 text-xs font-medium bg-slate-50/40 rounded-2xl border border-dashed border-slate-200">
          该周期内暂无骑行记录
        </div>
      )}
    </div>
  );
}

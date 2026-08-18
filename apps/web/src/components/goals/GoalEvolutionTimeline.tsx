import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { GoalMilestone } from '../../types/rider';

interface Props {
  milestones: GoalMilestone[];
}

export default function GoalEvolutionTimeline({ milestones }: Props) {
  if (!milestones || milestones.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg p-6 border border-slate-200/80 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-900">
            阶段目标演进记录
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          基于骑行做功与均速表现的调整记录
        </span>
      </div>

      {/* Timeline List */}
      <div className="relative pl-5 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
        {milestones.map((ms, index) => {
          const isLatest = index === 0;
          const dateStr = ms.created_at
            ? new Date(ms.created_at * 1000).toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              })
            : '未知时间';

          const isCoach = ms.source === 'coach' || ms.source === 'coaching';

          return (
            <div key={ms.id || index} className="relative group">
              {/* Timeline Dot */}
              <div
                className={`absolute -left-5 top-1.5 w-3 h-3 rounded-full border-2 border-white ${
                  isLatest
                    ? 'bg-slate-900'
                    : 'bg-slate-300'
                }`}
              />

              {/* Milestone Card */}
              <div
                className={`p-4 rounded border transition-colors ${
                  isLatest
                    ? 'bg-white border-slate-900 border-l-2'
                    : 'bg-white border-slate-200/80'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 font-mono text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-slate-400">
                      {dateStr}
                    </span>

                    {isLatest && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900 text-white flex items-center space-x-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>当前生效中</span>
                      </span>
                    )}

                    <span
                      className="text-[10px] px-1.5 py-0.2 rounded border border-slate-200 bg-slate-50 text-slate-600"
                    >
                      <span>{isCoach ? '系统自适应调优' : '车手手动设定'}</span>
                    </span>
                  </div>

                  {/* Quantitative Target Badges */}
                  <div className="flex items-center space-x-2 text-[11px]">
                    <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                      单周 <span className="font-semibold text-slate-900">{ms.weekly_distance_km}</span> km
                    </span>
                    <span className="text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                      停表均速 <span className="font-semibold text-slate-900">{ms.target_avg_speed_kmh}</span> km/h
                    </span>
                  </div>
                </div>

                {/* Main Goal Headline */}
                {ms.primary_goal && (
                  <div className="pt-2 text-xs font-medium text-slate-900 leading-snug">
                    {ms.primary_goal}
                  </div>
                )}

                {/* Rationale Note */}
                <p className="pt-1 text-[11px] text-slate-500 leading-relaxed">
                  <span className="font-medium text-slate-700">演进依据：</span>
                  {ms.rationale || '根据近期实战停表均速与体能负荷表现调整'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

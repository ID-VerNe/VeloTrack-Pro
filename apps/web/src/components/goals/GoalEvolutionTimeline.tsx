import React from 'react';
import { History, CheckCircle2, SlidersHorizontal, User } from 'lucide-react';
import type { GoalMilestone } from '../../types/rider';

interface Props {
  milestones: GoalMilestone[];
  onAskCoach: () => void;
}

export default function GoalEvolutionTimeline({ milestones, onAskCoach }: Props) {
  if (!milestones || milestones.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <History className="w-4 h-4 text-slate-900" />
          <h3 className="text-xs font-bold text-slate-900 tracking-tight">
            阶段目标演进记录 (Goal Milestones)
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-medium">
          记录系统根据实战做功与均速表现调优的历史快照
        </span>
      </div>

      {/* Timeline List */}
      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
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
                className={`absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs flex items-center justify-center transition-transform group-hover:scale-110 ${
                  isLatest
                    ? 'bg-slate-900 ring-2 ring-slate-200 ring-offset-1'
                    : 'bg-slate-300'
                }`}
              />

              {/* Milestone Card */}
              <div
                className={`p-4 rounded-xl border transition-all shadow-2xs ${
                  isLatest
                    ? 'bg-slate-50/90 border-slate-300 hover:border-slate-400'
                    : 'bg-slate-50/50 border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-mono font-bold text-slate-500">
                      {dateStr}
                    </span>

                    {isLatest && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-900 text-white flex items-center space-x-1 shadow-2xs font-mono">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>当前生效中</span>
                      </span>
                    )}

                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center space-x-1 ${
                        isCoach
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isCoach ? <SlidersHorizontal className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
                      <span>{isCoach ? '系统自适应调优' : '车手手动设定'}</span>
                    </span>
                  </div>

                  {/* Quantitative Target Badges */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                      单周 <span className="font-mono text-slate-900 font-extrabold">{ms.weekly_distance_km}</span> km
                    </span>
                    <span className="text-xs font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs">
                      停表均速 <span className="font-mono text-emerald-600 font-extrabold">{ms.target_avg_speed_kmh}</span> km/h
                    </span>
                  </div>
                </div>

                {/* Main Goal Headline */}
                {ms.primary_goal && (
                  <div className="pt-2 text-xs font-bold text-slate-900 leading-snug">
                    {ms.primary_goal}
                  </div>
                )}

                {/* Rationale Note */}
                <p className="pt-1 text-[11px] text-slate-600 leading-relaxed font-medium">
                  <span className="font-bold text-slate-700">演进依据：</span>
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

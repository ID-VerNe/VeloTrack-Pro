import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { MilestoneAchievement } from '../../utils/goalCalculations';

interface Props {
  achievements: MilestoneAchievement[];
}

export default function AchievementsGrid({ achievements }: Props) {
  return (
    <div className="bg-white rounded-lg p-6 border border-slate-200/80 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-900">
            个人里程碑与实战勋章
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">骑行数据达成记录</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {achievements.map((ach) => (
          <div
            key={ach.id}
            className={`p-4 rounded border transition-colors flex flex-col justify-between space-y-3 ${
              ach.unlocked
                ? 'bg-white border-slate-200/80'
                : 'bg-slate-50/50 border-dashed border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-sm">
                {ach.icon}
              </div>
              {ach.unlocked ? (
                <span className="flex items-center text-[10px] font-mono text-slate-700 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-slate-600" />
                  {ach.date}
                </span>
              ) : (
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {ach.date}
                </span>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-900">{ach.title}</div>
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{ach.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

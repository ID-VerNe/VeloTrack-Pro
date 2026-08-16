import React from 'react';
import { Trophy, CheckCircle2 } from 'lucide-react';
import type { MilestoneAchievement } from '../../utils/goalCalculations';

interface Props {
  achievements: MilestoneAchievement[];
}

export default function AchievementsGrid({ achievements }: Props) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100/80 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="text-xs font-bold text-slate-900">
            个人里程碑与实战勋章
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-medium">真实骑行数据达成验证</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {achievements.map((ach) => (
          <div
            key={ach.id}
            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
              ach.unlocked
                ? 'bg-slate-50/70 border-slate-200/80 shadow-2xs'
                : 'bg-slate-50/30 border-dashed border-slate-200 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-slate-100 flex items-center justify-center text-lg">
                {ach.icon}
              </div>
              {ach.unlocked ? (
                <span className="flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                  {ach.date}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  {ach.date}
                </span>
              )}
            </div>

            <div>
              <div className="text-xs font-bold text-slate-900">{ach.title}</div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{ach.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

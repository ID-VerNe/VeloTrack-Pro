import React from 'react';
import { CalendarRange, Sliders } from 'lucide-react';

interface Props {
  coachNotes?: string;
  onAskCoach: () => void;
}

export default function CoachPlanSection({ coachNotes, onAskCoach }: Props) {
  const weeklyPlans = [
    {
      week: '第 1 周',
      focus: '高踏频有氧基底打磨',
      target: '35 km (2~3 次)',
      ratio: '平路 46×19T/21T · 踏频 88-92 rpm',
      zone: 'Zone 2 有氧耐力',
      note: '以膝关节零痛感、平稳呼吸为第一指标，杜绝大齿比重踩',
    },
    {
      week: '第 2 周',
      focus: '巡航定速与节奏巩固',
      target: '45 km (2~3 次)',
      ratio: '平路 46×17T/19T · 踏频 90 rpm',
      zone: 'Zone 2-3 节奏区间',
      note: '深圳湾或二沙岛连续 15km 不间断巡航，稳定输出 18~19 km/h',
    },
    {
      week: '第 3 周',
      focus: '微起伏变速与耐力负荷',
      target: '50 km (包含 1 次 30km 长距离)',
      ratio: '起伏路及时挂 24T/28T 飞轮',
      zone: 'Zone 3 甜点突破',
      note: '单次突破 30+km，遇缓坡前提早 20 米降档，保护半月板',
    },
    {
      week: '第 4 周',
      focus: '巡航 20km/h 达标验收周',
      target: '55 km (总体验收)',
      ratio: '顺风/平路 46×15T/17T · 踏频 85-95 rpm',
      zone: 'Zone 3-4 巡航冲刺',
      note: '目标巡航均速稳步达到 20km/h，并在周末进行一次充分拉伸放松',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Tactical Guidance Callout Banner */}
      <div className="bg-slate-900 rounded-2xl p-5 text-white shadow-sm border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center space-x-2">
            <span className="bg-white/10 text-slate-200 font-bold text-xs uppercase tracking-wider px-2 py-0.5 rounded-md font-mono">
              战术指导原则
            </span>
            <span className="text-slate-500 text-xs font-medium">大行 P8 传动比专属适配</span>
          </div>
          <p className="text-sm font-bold leading-relaxed pt-0.5 text-slate-100">
            "{coachNotes || '保持85-95rpm高踏频，平路以46x19T为主，保护膝盖稳定提速'}"
          </p>
        </div>

        <button
          onClick={onAskCoach}
          className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer shrink-0 flex items-center space-x-1.5"
        >
          <Sliders className="w-3.5 h-3.5 text-slate-700" />
          <span>进入决策舱调整</span>
        </button>
      </div>

      {/* 4-Week Progressive Workout Plan */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CalendarRange className="w-4 h-4 text-slate-900" />
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">
              4 周阶梯进阶训练课表 (目标 20km/h 定速巡航)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            兼顾心肺负荷适应与关节做功保护
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {weeklyPlans.map((plan) => (
            <div
              key={plan.week}
              className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 shadow-2xs space-y-2 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 pb-1">
                  <span className="text-slate-900 font-extrabold">{plan.week}</span>
                  <span className="text-xs text-slate-500 font-semibold font-mono">{plan.target}</span>
                </div>
                <div className="text-xs font-bold text-slate-800">{plan.focus}</div>
                <div className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-1.5 mt-2 font-medium space-y-0.5">
                  <div className="text-xs text-slate-500 font-mono">{plan.zone}</div>
                  <div className="font-semibold text-slate-800 text-xs">{plan.ratio}</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium pt-1 border-t border-slate-200/60 mt-2">
                {plan.note}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

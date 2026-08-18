import React from 'react';

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
      <div className="bg-white rounded-lg p-5 border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex items-center space-x-2 font-mono">
            <span className="text-[10px] text-slate-400 uppercase tracking-widest">
              指导原则
            </span>
            <span className="text-slate-400 text-[11px]">大行 P8 传动比适配</span>
          </div>
          <p className="text-xs text-slate-800 leading-relaxed font-normal">
            "{coachNotes || '保持85-95rpm高踏频，平路以46x19T为主，保护膝盖稳定提速'}"
          </p>
        </div>

        <button
          onClick={onAskCoach}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono rounded transition-colors cursor-pointer shrink-0 flex items-center space-x-1.5"
        >
          <span>进入决策舱调整</span>
        </button>
      </div>

      {/* 4-Week Progressive Workout Plan */}
      <div className="bg-white rounded-lg p-5 border border-slate-200/80 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-xs font-semibold text-slate-900">
              4 周进阶课表 (目标 20km/h 定速巡航)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            兼顾心肺负荷与膝关节保护
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {weeklyPlans.map((plan) => (
            <div
              key={plan.week}
              className="bg-slate-50/50 p-4 rounded border border-slate-200/80 space-y-2 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs pb-1 font-mono">
                  <span className="text-slate-900 font-semibold">{plan.week}</span>
                  <span className="text-[11px] text-slate-400">{plan.target}</span>
                </div>
                <div className="text-xs text-slate-800 font-medium">{plan.focus}</div>
                <div className="text-xs text-slate-600 bg-white border border-slate-200 rounded p-2 mt-2 font-mono space-y-0.5">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">{plan.zone}</div>
                  <div className="text-xs text-slate-800">{plan.ratio}</div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pt-2 border-t border-slate-200/60 mt-2">
                {plan.note}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

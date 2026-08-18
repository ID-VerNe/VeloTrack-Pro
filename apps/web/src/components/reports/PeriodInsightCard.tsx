import React from 'react';
import { RefreshCw } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';

interface Props {
  insight: string | null;
  isLoading: boolean;
  onGenerate: () => void;
}

export default function PeriodInsightCard({ insight, isLoading, onGenerate }: Props) {
  return (
    <div className="bg-white rounded-lg p-6 border border-slate-200/80 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-xs font-semibold text-slate-900 leading-tight">
            周期负荷与生物力学诊断
          </h3>
          <p className="text-[11px] text-slate-400 font-normal mt-0.5">
            结合战车传动比、做功功率与踏频一致性的综合表现诊断
          </p>
        </div>

        <button
          onClick={onGenerate}
          disabled={isLoading}
          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono rounded transition-colors cursor-pointer flex items-center space-x-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>{isLoading ? '计算中...' : insight ? '重新诊断' : '开始周期诊断'}</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-10 flex flex-col items-center justify-center text-slate-400 text-xs space-y-2 bg-slate-50/50 rounded border border-slate-200 font-mono">
          <RefreshCw className="w-4 h-4 text-slate-600 animate-spin" />
          <p className="text-slate-800 font-medium">正在计算周期做功负荷与踏频分布数据...</p>
          <p className="text-[11px] text-slate-400">评估负荷疲劳比、膝关节受力与下一阶段阶梯课表</p>
        </div>
      ) : insight ? (
        <div className="markdown-body pt-1">
          <MarkdownRenderer content={insight} />
        </div>
      ) : (
        <div className="py-8 text-center text-slate-400 text-xs bg-slate-50/50 rounded border border-dashed border-slate-200 font-mono">
          点击右上角「开始周期诊断」，系统将自动计算本周期踏频达成率与负荷疲劳比。
        </div>
      )}
    </div>
  );
}

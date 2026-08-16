import React from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';

interface Props {
  insight: string | null;
  isLoading: boolean;
  isCached: boolean;
  onRegenerate: () => void;
}

export default function RideInsightCard({
  insight,
  isLoading,
  isCached,
  onRegenerate,
}: Props) {
  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-2xs">
            <Activity className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 leading-tight">
              动力学与体能负荷复盘
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">
              结合战车传动比、爬升做功与踏频分布的生理诊断
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isCached && !isLoading && (
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
              已存档
            </span>
          )}
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center space-x-1 shadow-2xs"
            title="重新计算生理与动力学负荷指标"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? '计算中...' : '重新诊断'}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 flex flex-col items-center justify-center text-slate-400 text-xs space-y-2 bg-slate-50 rounded-xl border border-slate-100">
          <RefreshCw className="w-4 h-4 text-slate-600 animate-spin" />
          <p className="font-semibold text-slate-700">正在计算做功负荷与生物力学指标...</p>
          <p className="text-[11px] text-slate-400">分析踏频节奏、膝关节受力与下一阶段进阶建议</p>
        </div>
      ) : insight ? (
        <div className="markdown-body">
          <MarkdownRenderer content={insight} />
        </div>
      ) : (
        <div className="py-6 text-center text-slate-400 text-xs font-medium bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
          点击右上角「重新诊断」获取动力学与生理复盘报告
        </div>
      )}
    </div>
  );
}

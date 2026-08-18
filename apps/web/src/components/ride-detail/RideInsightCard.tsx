import React from 'react';
import { RefreshCw } from 'lucide-react';
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
    <div className="bg-white rounded-lg p-6 border border-slate-200/80 space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-xs font-semibold text-slate-900 leading-tight">
            动力学与体能负荷复盘
          </h3>
          <p className="text-[11px] text-slate-400 font-normal mt-0.5">
            结合战车传动比、爬升做功与踏频分布的生理诊断
          </p>
        </div>

        <div className="flex items-center space-x-2 font-mono">
          {isCached && !isLoading && (
            <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
              已存档
            </span>
          )}
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs transition-colors cursor-pointer flex items-center space-x-1.5"
            title="重新计算生理与动力学负荷指标"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? '计算中...' : '重新诊断'}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-8 flex flex-col items-center justify-center text-slate-400 text-xs space-y-2 bg-slate-50/50 rounded border border-slate-200 font-mono">
          <RefreshCw className="w-4 h-4 text-slate-600 animate-spin" />
          <p className="text-slate-800 font-medium">正在计算做功负荷与生物力学指标...</p>
          <p className="text-[11px] text-slate-400">分析踏频节奏、膝关节受力与下一阶段进阶建议</p>
        </div>
      ) : insight ? (
        <div className="markdown-body">
          <MarkdownRenderer content={insight} />
        </div>
      ) : (
        <div className="py-6 text-center text-slate-400 text-xs bg-slate-50/50 rounded border border-dashed border-slate-200 font-mono">
          点击右上角「重新诊断」获取动力学与生理复盘报告
        </div>
      )}
    </div>
  );
}

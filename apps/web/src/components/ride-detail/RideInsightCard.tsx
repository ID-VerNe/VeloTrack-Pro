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
    <div className="pt-4 space-y-6">
      <div className="flex items-end justify-between border-b border-black/10 pb-4">
        <div>
          <h3 className="text-[15px] font-medium text-black leading-tight">
            动力学与体能负荷复盘
          </h3>
          <p className="text-[13px] text-black/64 font-normal mt-1.5">
            结合战车传动比、爬升做功与踏频分布的生理诊断
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isCached && !isLoading && (
            <span className="text-[12px] text-black/44 px-2 py-0.5">
              已存档
            </span>
          )}
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="px-3 py-1.5 bg-black/5 hover:bg-black/10 text-black rounded text-[13px] transition-colors cursor-pointer flex items-center space-x-1.5"
            title="重新计算生理与动力学负荷指标"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? '计算中...' : '重新诊断'}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-4 h-4 text-black/44 animate-spin" />
          <p className="text-[13px] text-black/64">正在计算做功负荷与生物力学指标...</p>
        </div>
      ) : insight ? (
        <div className="markdown-body text-[14px] text-black/80 leading-relaxed">
          <MarkdownRenderer content={insight} />
        </div>
      ) : (
        <div className="py-12 text-center text-[13px] text-black/44">
          点击右上角「重新诊断」获取动力学与生理复盘报告
        </div>
      )}
    </div>
  );
}

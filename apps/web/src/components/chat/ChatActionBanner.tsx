import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { ChatActionType } from '../../utils/chatActionDetector';

export interface ChatActionBannerProps {
  actionType: ChatActionType;
  onOpenProfile?: () => void;
}

export default function ChatActionBanner({
  actionType,
  onOpenProfile,
}: ChatActionBannerProps) {
  if (actionType === 'goal') {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 text-xs">
            阶段训练目标与量化指标已写入生效
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
            已同步至目标看板，周目标与巡航基准已更新
          </p>
        </div>
        <Link
          to="/goals"
          className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-md text-xs font-mono transition-colors flex items-center space-x-1 shrink-0 cursor-pointer shadow-2xs"
        >
          <span>查看目标进度</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  if (actionType === 'profile') {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 text-xs">
            战车硬件参数与传动规格已成功更新
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
            车辆参数与齿比配置已更新
          </p>
        </div>
        {onOpenProfile && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-md text-xs font-mono transition-colors flex items-center space-x-1 shrink-0 cursor-pointer shadow-2xs"
          >
            <span>查看档案</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  return null;
}

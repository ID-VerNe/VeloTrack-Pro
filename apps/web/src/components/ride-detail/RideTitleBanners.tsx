import React from 'react';
import { RotateCcw } from 'lucide-react';

interface Props {
  suggestedTitle: string | null;
  previousTitle: string | null;
  onApplySuggestedTitle: () => void;
  onCancelSuggestedTitle: () => void;
  onUndoTitle: () => void;
}

export default function RideTitleBanners({
  suggestedTitle,
  previousTitle,
  onApplySuggestedTitle,
  onCancelSuggestedTitle,
  onUndoTitle,
}: Props) {
  return (
    <>
      {/* Suggested Title Confirmation Banner */}
      {suggestedTitle && (
        <div className="p-4 bg-slate-50 rounded flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150 mt-4">
          <div className="flex items-center space-x-3 text-[13px]">
            <span className="text-slate-500">
              规范命名建议
            </span>
            <span className="font-medium text-slate-900">「{suggestedTitle}」</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onApplySuggestedTitle}
              className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white text-[13px] rounded transition-colors cursor-pointer shadow-2xs"
            >
              应用
            </button>
            <button
              onClick={onCancelSuggestedTitle}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 text-[13px] rounded transition-colors cursor-pointer"
            >
              忽略
            </button>
          </div>
        </div>
      )}

      {/* Undo Notification Banner */}
      {previousTitle && (
        <div className="p-4 bg-brand-900 text-white rounded flex items-center justify-between text-[13px] border border-brand-800 shadow-sm animate-in fade-in slide-in-from-top-1 duration-150 mt-4">
          <span>标题已更新。原标题：「{previousTitle}」</span>
          <button
            onClick={onUndoTitle}
            className="flex items-center space-x-1 text-brand-200 hover:text-white font-medium ml-4 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>撤销</span>
          </button>
        </div>
      )}
    </>
  );
}

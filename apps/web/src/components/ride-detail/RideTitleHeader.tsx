import React, { useState } from 'react';
import IconButton from '../common/IconButton';
import RideHeaderToolbar from './RideHeaderToolbar';
import RideTitleBanners from './RideTitleBanners';
import { Edit2, Check, X, Tag } from 'lucide-react';

interface Props {
  title: string;
  fromLabel: string;
  isSuggestingTitle: boolean;
  suggestedTitle: string | null;
  previousTitle: string | null;
  onGoBack: () => void;
  onSaveTitle: (newTitle: string) => void;
  onAIPolishTitle: () => void;
  onApplySuggestedTitle: () => void;
  onCancelSuggestedTitle: () => void;
  onUndoTitle: () => void;
  onExportGPX: () => void;
  onOpenProfile: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  deleteError?: string | null;
}

export default function RideTitleHeader({
  title,
  fromLabel,
  isSuggestingTitle,
  suggestedTitle,
  previousTitle,
  onGoBack,
  onSaveTitle,
  onAIPolishTitle,
  onApplySuggestedTitle,
  onCancelSuggestedTitle,
  onUndoTitle,
  onExportGPX,
  onOpenProfile,
  onDelete,
  isDeleting = false,
  deleteError = null,
}: Props) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [customTitle, setCustomTitle] = useState(title);
  const [isComposing, setIsComposing] = useState(false);

  const handleStartEdit = () => {
    setCustomTitle(title);
    setIsEditingTitle(true);
  };

  const handleConfirmSave = () => {
    if (isComposing) return;
    if (customTitle.trim() && customTitle.trim() !== title) {
      onSaveTitle(customTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setCustomTitle(title);
    setIsEditingTitle(false);
  };

  return (
    <div className="space-y-4">
      {/* 顶部操作工具栏与删除确认弹窗 */}
      <RideHeaderToolbar
        fromLabel={fromLabel}
        onGoBack={onGoBack}
        onExportGPX={onExportGPX}
        onOpenProfile={onOpenProfile}
        onDelete={onDelete}
        isDeleting={isDeleting}
        deleteError={deleteError}
      />

      {/* 标题呈现与交互式重命名编辑 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
        {isEditingTitle ? (
          <div className="flex items-center space-x-3 flex-1 max-w-lg">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-1p-ignore="true"
              data-lpignore="true"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isComposing) {
                  e.preventDefault();
                  handleConfirmSave();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCancelEdit();
                }
              }}
              autoFocus
              className="flex-1 px-3 py-2 bg-slate-50 border border-transparent focus:border-slate-200 rounded-lg text-[22px] sm:text-[24px] font-medium text-slate-900 focus:outline-none"
            />
            <button
              onClick={handleConfirmSave}
              className="p-2.5 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white rounded-md transition-colors cursor-pointer shadow-2xs"
              aria-label="确认保存"
            >
              <Check className="w-5 h-5" aria-hidden="true" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-900 rounded-md transition-colors cursor-pointer border border-slate-200/60"
              aria-label="取消修改"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-4 group">
            <h1 className="text-[24px] sm:text-[28px] font-semibold text-slate-900 tracking-tight leading-[1.2]">
              {title}
            </h1>
            <div className="flex items-center space-x-2 opacity-70 group-hover:opacity-100 transition-opacity">
              <IconButton label="手动重命名" size="sm" onClick={handleStartEdit} className="bg-slate-50 hover:bg-slate-100 rounded-md border border-slate-200/60">
                <Edit2 className="w-4 h-4 text-slate-600" aria-hidden="true" />
              </IconButton>

              <button
                onClick={onAIPolishTitle}
                disabled={isSuggestingTitle}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 rounded-md text-[13px] transition-colors cursor-pointer flex items-center space-x-1.5 border border-slate-200/60"
                title="依据时间/时段/城市/强度生成规范命名"
              >
                <Tag className={`w-3.5 h-3.5 ${isSuggestingTitle ? 'animate-spin text-slate-900' : 'text-slate-500'}`} aria-hidden="true" />
                <span>{isSuggestingTitle ? '生成中...' : '规范路段命名'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI 建议横幅与撤销操作提示 */}
      <RideTitleBanners
        suggestedTitle={suggestedTitle}
        previousTitle={previousTitle}
        onApplySuggestedTitle={onApplySuggestedTitle}
        onCancelSuggestedTitle={onCancelSuggestedTitle}
        onUndoTitle={onUndoTitle}
      />
    </div>
  );
}

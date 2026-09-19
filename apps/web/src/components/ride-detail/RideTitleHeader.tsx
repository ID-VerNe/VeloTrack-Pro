import React, { useState } from 'react';
import IconButton from '../common/IconButton';
import ConfirmModal from '../common/ConfirmModal';
import { 
  ArrowLeft, 
  Edit2, 
  Check, 
  X, 
  Tag, 
  RotateCcw, 
  Download, 
  User,
  Trash2
} from 'lucide-react';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      {/* Top action row */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <button
          onClick={onGoBack}
          aria-label={fromLabel}
          className="hidden md:inline-flex items-center text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5 transition-transform group-hover:-translate-x-1 translate-y-[-0.5px]" aria-hidden="true" />
          {fromLabel}
        </button>

        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={onExportGPX}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-[13px] rounded-md transition-colors cursor-pointer flex items-center space-x-1.5 border border-slate-200/60"
            aria-label="导出 GPX 轨迹文件"
          >
            <Download className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>导出 GPX</span>
          </button>

          <button
            onClick={onOpenProfile}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-[13px] rounded-md transition-colors cursor-pointer flex items-center space-x-1.5 border border-slate-200/60"
            aria-label="查看车手生物力学档案与战车硬件"
          >
            <User className="w-4 h-4 text-slate-500" aria-hidden="true" />
            <span>车手档案</span>
          </button>

          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="px-2.5 py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-[13px] rounded-md transition-colors cursor-pointer flex items-center space-x-1 group"
              aria-label="删除此条骑行记录"
            >
              <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-rose-500" aria-hidden="true" />
              <span>删除</span>
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="删除骑行记录"
        description="确定要删除此骑行记录吗？此操作无法撤销。"
        confirmText="确认删除"
        cancelText="取消"
        isDanger={true}
        isLoading={isDeleting}
        loadingText="正在删除..."
        errorMessage={deleteError}
        onConfirm={() => {
          setShowDeleteConfirm(false);
          onDelete?.();
        }}
        onClose={() => setShowDeleteConfirm(false)}
      />

      {/* Delete Error Banner */}
      {deleteError && (
        <div className="p-4 bg-red-50 border border-red-100 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150 rounded">
          <span className="text-[13px] text-red-600 font-medium">{deleteError}</span>
        </div>
      )}

      {/* Title & Interactive Rename Flow */}
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
    </div>
  );
}

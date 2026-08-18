import React, { useState } from 'react';
import IconButton from '../common/IconButton';
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
      <div className="flex items-center justify-between">
        <button
          onClick={onGoBack}
          className="inline-flex items-center text-xs font-mono font-medium text-slate-500 hover:text-slate-900 transition-colors py-1 cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5 transition-transform group-hover:-translate-x-0.5" />
          {fromLabel}
        </button>

        <div className="flex items-center space-x-2 font-mono">
          <button
            onClick={onExportGPX}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs rounded border border-slate-200 shadow-2xs transition-colors cursor-pointer flex items-center space-x-1"
            title="导出 GPX 轨迹文件"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>导出 GPX</span>
          </button>

          <button
            onClick={onOpenProfile}
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded transition-colors cursor-pointer flex items-center space-x-1"
            title="查看车手生物力学档案与战车硬件"
          >
            <User className="w-3.5 h-3.5 text-slate-300" />
            <span>车手档案</span>
          </button>

          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="px-2.5 py-1.5 bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 text-xs rounded border border-slate-200 shadow-2xs transition-colors cursor-pointer flex items-center space-x-1"
              title="删除此条骑行记录"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500" />
              <span>删除</span>
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Banner */}
      {showDeleteConfirm && (
        <div className="p-3 bg-rose-50/80 border border-rose-200/80 rounded flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="text-xs text-rose-800 font-medium font-sans">
            确定要删除此骑行记录吗？此操作无法撤销。
          </span>
          <div className="flex items-center space-x-2 font-mono">
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                onDelete?.();
              }}
              disabled={isDeleting}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded transition-colors cursor-pointer"
            >
              {isDeleting ? '正在删除...' : '确认删除'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2.5 py-1 text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Title & Interactive Rename Flow */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {isEditingTitle ? (
          <div className="flex items-center space-x-2 flex-1 max-w-md">
            <input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
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
              className="flex-1 px-3 py-1.5 bg-white border border-slate-900 rounded text-lg font-semibold text-slate-900 focus:outline-none"
            />
            <button
              onClick={handleConfirmSave}
              className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded transition-colors cursor-pointer"
              title="确认保存"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded transition-colors cursor-pointer"
              title="取消修改"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-3 group">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
              {title}
            </h1>
            <div className="flex items-center space-x-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
              <IconButton label="手动重命名" size="sm" onClick={handleStartEdit}>
                <Edit2 className="w-3.5 h-3.5" />
              </IconButton>

              <button
                onClick={onAIPolishTitle}
                disabled={isSuggestingTitle}
                className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-600 rounded text-xs font-mono border border-slate-200 transition-colors cursor-pointer flex items-center space-x-1"
                title="依据时间/时段/城市/强度生成规范命名"
              >
                <Tag className={`w-3 h-3 ${isSuggestingTitle ? 'animate-spin text-slate-900' : 'text-slate-400'}`} />
                <span>{isSuggestingTitle ? '生成中...' : '规范路段命名'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Title Confirmation Banner */}
      {suggestedTitle && (
        <div className="p-3 bg-white border border-slate-200 rounded flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center space-x-2 text-xs">
            <span className="bg-slate-100 text-slate-800 font-medium px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-200">
              规范命名建议
            </span>
            <span className="font-medium text-slate-900">「{suggestedTitle}」</span>
          </div>
          <div className="flex items-center space-x-2 font-mono">
            <button
              onClick={onApplySuggestedTitle}
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white text-xs rounded transition-colors cursor-pointer"
            >
              应用
            </button>
            <button
              onClick={onCancelSuggestedTitle}
              className="px-2.5 py-1 text-slate-400 hover:text-slate-800 text-xs cursor-pointer"
            >
              忽略
            </button>
          </div>
        </div>
      )}

      {/* Undo Notification Banner */}
      {previousTitle && (
        <div className="p-2.5 bg-slate-900 text-white rounded flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-1 duration-150 font-mono">
          <span>标题已更新。原标题：「{previousTitle}」</span>
          <button
            onClick={onUndoTitle}
            className="flex items-center space-x-1 text-slate-300 hover:text-white font-medium ml-3 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>撤销</span>
          </button>
        </div>
      )}
    </div>
  );
}

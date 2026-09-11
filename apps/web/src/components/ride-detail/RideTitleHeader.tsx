import React, { useState } from 'react';
import IconButton from '../common/IconButton';
import { getAdminToken } from '../../utils/activity/adminApiClient';
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
      <div className="flex items-center justify-between pb-2 border-b border-black/10">
        <button
          onClick={onGoBack}
          className="inline-flex items-center text-[13px] font-medium text-black/64 hover:text-black transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 transition-transform group-hover:-translate-x-1" />
          {fromLabel}
        </button>

        <div className="flex items-center space-x-3">
          <button
            onClick={onExportGPX}
            className="px-3 py-1.5 bg-black/5 hover:bg-black/10 text-black text-[13px] rounded transition-colors cursor-pointer flex items-center space-x-1.5"
            title="导出 GPX 轨迹文件"
          >
            <Download className="w-4 h-4 text-black/64" />
            <span>导出 GPX</span>
          </button>

          <button
            onClick={onOpenProfile}
            className="px-3 py-1.5 bg-black/5 hover:bg-black/10 text-black text-[13px] rounded transition-colors cursor-pointer flex items-center space-x-1.5"
            title="查看车手生物力学档案与战车硬件"
          >
            <User className="w-4 h-4 text-black/64" />
            <span>车手档案</span>
          </button>

          {onDelete && (
            <button
              onClick={() => {
                const token = getAdminToken();
                if (!token) {
                  alert('未检测到管理令牌（ADMIN_TOKEN），无法删除。请先前往「数据入库」页面配置有效的管理令牌。');
                  return;
                }
                setShowDeleteConfirm(true);
              }}
              disabled={isDeleting}
              className="px-3 py-1.5 bg-black/5 hover:bg-black/10 text-black hover:text-red-600 text-[13px] rounded transition-colors cursor-pointer flex items-center space-x-1.5"
              title="删除此条骑行记录"
            >
              <Trash2 className="w-4 h-4 text-black/64 group-hover:text-red-500" />
              <span>删除</span>
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Banner */}
      {showDeleteConfirm && (
        <div className="p-4 bg-black/5 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150 rounded">
          <span className="text-[13px] text-black font-medium">
            确定要删除此骑行记录吗？此操作无法撤销。
          </span>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                onDelete?.();
              }}
              disabled={isDeleting}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-[13px] rounded transition-colors cursor-pointer"
            >
              {isDeleting ? '正在删除...' : '确认删除'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 bg-black/5 hover:bg-black/10 text-black text-[13px] rounded transition-colors cursor-pointer"
            >
              取消
            </button>
          </div>
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
              className="flex-1 px-3 py-2 bg-black/5 border border-transparent focus:border-black/10 rounded text-[24px] font-medium text-black focus:outline-none"
            />
            <button
              onClick={handleConfirmSave}
              className="p-2.5 bg-black hover:bg-black/80 text-white rounded transition-colors cursor-pointer"
              title="确认保存"
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              onClick={handleCancelEdit}
              className="p-2.5 bg-black/5 hover:bg-black/10 text-black rounded transition-colors cursor-pointer"
              title="取消修改"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-4 group">
            <h1 className="text-[28px] font-medium text-black tracking-tight leading-none">
              {title}
            </h1>
            <div className="flex items-center space-x-2 opacity-70 group-hover:opacity-100 transition-opacity">
              <IconButton label="手动重命名" size="sm" onClick={handleStartEdit} className="bg-black/5 hover:bg-black/10 rounded">
                <Edit2 className="w-4 h-4 text-black/64" />
              </IconButton>

              <button
                onClick={onAIPolishTitle}
                disabled={isSuggestingTitle}
                className="px-3 py-1.5 bg-black/5 hover:bg-black/10 text-black rounded text-[13px] transition-colors cursor-pointer flex items-center space-x-1.5"
                title="依据时间/时段/城市/强度生成规范命名"
              >
                <Tag className={`w-3.5 h-3.5 ${isSuggestingTitle ? 'animate-spin text-black' : 'text-black/64'}`} />
                <span>{isSuggestingTitle ? '生成中...' : '规范路段命名'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Title Confirmation Banner */}
      {suggestedTitle && (
        <div className="p-4 bg-black/5 rounded flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150 mt-4">
          <div className="flex items-center space-x-3 text-[13px]">
            <span className="text-black/44">
              规范命名建议
            </span>
            <span className="font-medium text-black">「{suggestedTitle}」</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onApplySuggestedTitle}
              className="px-3 py-1.5 bg-black hover:bg-black/80 text-white text-[13px] rounded transition-colors cursor-pointer"
            >
              应用
            </button>
            <button
              onClick={onCancelSuggestedTitle}
              className="px-3 py-1.5 bg-black/5 hover:bg-black/10 text-black text-[13px] rounded transition-colors cursor-pointer"
            >
              忽略
            </button>
          </div>
        </div>
      )}

      {/* Undo Notification Banner */}
      {previousTitle && (
        <div className="p-4 bg-black text-white rounded flex items-center justify-between text-[13px] animate-in fade-in slide-in-from-top-1 duration-150 mt-4">
          <span>标题已更新。原标题：「{previousTitle}」</span>
          <button
            onClick={onUndoTitle}
            className="flex items-center space-x-1 text-white/80 hover:text-white font-medium ml-4 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>撤销</span>
          </button>
        </div>
      )}
    </div>
  );
}

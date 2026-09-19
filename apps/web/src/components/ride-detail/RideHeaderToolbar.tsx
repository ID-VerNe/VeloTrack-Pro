import React, { useState } from 'react';
import ConfirmModal from '../common/ConfirmModal';
import { ArrowLeft, Download, User, Trash2 } from 'lucide-react';

interface Props {
  fromLabel: string;
  onGoBack: () => void;
  onExportGPX: () => void;
  onOpenProfile: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  deleteError?: string | null;
}

export default function RideHeaderToolbar({
  fromLabel,
  onGoBack,
  onExportGPX,
  onOpenProfile,
  onDelete,
  isDeleting = false,
  deleteError = null,
}: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <>
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
    </>
  );
}

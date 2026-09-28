// apps/web/src/components/common/ConfirmModal.tsx
//
// 通用二次确认模态对话框组件
// 遵循单一职责（SRP）与 DRY 原则，统一全站高危操作（删除、重置）的确认体验与无障碍标准。

import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  errorMessage?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  isDanger = true,
  isLoading = false,
  loadingText = '处理中...',
  errorMessage = null,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  // ESC 键监听
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform-gpu duration-300 ease-apple-spring animate-in fade-in zoom-in-95 border border-slate-100">
        <div className="px-6 py-5">
          <div className="flex items-center gap-2.5">
            {isDanger && (
              <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-600 -translate-y-[1px]" aria-hidden="true" />
              </div>
            )}
            <h3 id="confirm-modal-title" className="text-base font-semibold text-slate-900 leading-tight">
              {title}
            </h3>
          </div>

          <div className="mt-3 text-sm text-slate-600 leading-normal">{description}</div>

          {errorMessage && (
            <div
              role="alert"
              className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-600 font-medium leading-relaxed"
            >
              {errorMessage}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] transition-all duration-100 ease-out cursor-pointer disabled:opacity-50 disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg active:scale-[0.98] transition-all duration-100 ease-out cursor-pointer shadow-xs disabled:opacity-50 disabled:active:scale-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 border border-transparent focus-visible:ring-rose-500'
                : 'bg-brand-600 hover:bg-brand-700 active:bg-brand-800 border border-transparent focus-visible:ring-brand-500'
            }`}
          >
            {isLoading ? loadingText : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

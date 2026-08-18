import React, { useState, useEffect } from 'react';
import { X, Target } from 'lucide-react';
import { useDialog } from '../../hooks/useDialog';

export interface UserTargets {
  weeklyDistanceKm: number;
  targetAvgSpeedKmh: number;
  monthlyDistanceKm: number;
  annualDistanceKm: number;
  coachNotes?: string;
}

interface Props {
  isOpen: boolean;
  initialValues: UserTargets;
  onClose: () => void;
  onSave: (values: UserTargets) => Promise<void>;
}

export default function EditGoalsModal({
  isOpen,
  initialValues,
  onClose,
  onSave,
}: Props) {
  const [form, setForm] = useState<UserTargets>(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  // 弹层无障碍：焦点陷阱 + Esc 关闭 + 关闭后焦点返还
  const dialogRef = useDialog(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      setForm(initialValues);
    }
  }, [initialValues, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in select-none">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="设定科学训练目标"
        tabIndex={-1}
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150 focus:outline-none"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">设定科学训练目标</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                单周目标里程 (km)
              </label>
              <input
                type="number"
                step="5"
                value={form.weeklyDistanceKm}
                onChange={(e) =>
                  setForm({ ...form, weeklyDistanceKm: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                目标平路巡航均速 (km/h)
              </label>
              <input
                type="number"
                step="0.5"
                value={form.targetAvgSpeedKmh}
                onChange={(e) =>
                  setForm({ ...form, targetAvgSpeedKmh: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                单月目标里程 (km)
              </label>
              <input
                type="number"
                step="10"
                value={form.monthlyDistanceKm}
                onChange={(e) =>
                  setForm({ ...form, monthlyDistanceKm: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                全年度目标里程 (km)
              </label>
              <input
                type="number"
                step="50"
                value={form.annualDistanceKm}
                onChange={(e) =>
                  setForm({ ...form, annualDistanceKm: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              战术备忘与齿比说明
            </label>
            <textarea
              rows={2}
              value={form.coachNotes || ''}
              onChange={(e) => setForm({ ...form, coachNotes: e.target.value })}
              placeholder="例如：保持85-95rpm高踏频，平路以46x19T为主，保护膝盖稳定提速"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              {isSaving ? '保存中...' : '保存目标'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

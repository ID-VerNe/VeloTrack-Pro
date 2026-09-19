import React from 'react';
import { Trash2, ShieldAlert, Wrench, Compass } from 'lucide-react';
import type { RiderMemory } from '../../types/rider';

export function getMemoryCategoryMeta(cat: string) {
  if (cat === 'health' || cat === 'physiology') {
    return {
      label: '健康与身体底线',
      shortLabel: '身体底线',
      icon: ShieldAlert,
      color: 'bg-rose-50 text-rose-700 border-rose-200/80',
      cardBorder: 'hover:border-rose-300',
      badgeBg: 'bg-rose-100/70 text-rose-800',
    };
  }
  if (cat === 'gear') {
    return {
      label: '战车调校经验',
      shortLabel: '战车经验',
      icon: Wrench,
      color: 'bg-brand-50 text-brand-700 border-brand-200/80',
      cardBorder: 'hover:border-brand-300',
      badgeBg: 'bg-brand-100/70 text-brand-800',
    };
  }
  return {
    label: '习惯与训练偏好',
    shortLabel: '习惯偏好',
    icon: Compass,
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    cardBorder: 'hover:border-indigo-300',
    badgeBg: 'bg-indigo-100/70 text-indigo-800',
  };
}

export interface MemoryItemCardProps {
  memory: RiderMemory;
  isConfirmingDelete: boolean;
  onRequestDelete: (id: number) => void;
  onConfirmDelete: (id: number) => void;
  onCancelDelete: () => void;
}

export default function MemoryItemCard({
  memory,
  isConfirmingDelete,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: MemoryItemCardProps) {
  const meta = getMemoryCategoryMeta(memory.category);
  const Icon = meta.icon;
  const isCoachExtracted =
    memory.source === 'coach' ||
    memory.source === 'auto_extracted' ||
    memory.source === 'coaching';

  return (
    <div
      className={`p-3.5 bg-white hover:bg-slate-50/90 rounded-2xl border border-slate-200/90 ${meta.cardBorder} transition-all flex items-start justify-between gap-3 group shadow-2xs`}
    >
      <div className="space-y-1.5 min-w-0 flex-1">
        <div className="flex items-center space-x-2">
          <span
            className={`text-xs font-extrabold px-2 py-0.5 rounded-md border flex items-center space-x-1 ${meta.color}`}
          >
            <Icon className="w-2.5 h-2.5" />
            <span>{meta.shortLabel}</span>
          </span>

          <span
            className={`text-2xs font-bold px-1.5 py-0.2 rounded font-mono ${
              isCoachExtracted
                ? 'bg-slate-100 text-slate-700 border border-slate-200'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isCoachExtracted ? '实战沟通沉淀' : '手动设定'}
          </span>

          <span className="text-xs text-slate-500 font-mono ml-auto">
            {new Date((memory.created_at || Date.now() / 1000) * 1000).toLocaleDateString('zh-CN')}
          </span>
        </div>

        <p className="text-xs font-semibold text-slate-800 leading-relaxed break-words">
          {memory.content}
        </p>
      </div>

      {isConfirmingDelete ? (
        <div className="flex items-center space-x-1.5 shrink-0 bg-rose-50 border border-rose-200 rounded-xl p-1 animate-in fade-in">
          <button
            onClick={() => onConfirmDelete(memory.id)}
            className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            确认
          </button>
          <button
            onClick={onCancelDelete}
            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium border border-slate-200 transition-all cursor-pointer"
          >
            取消
          </button>
        </div>
      ) : (
        <button
          onClick={() => onRequestDelete(memory.id)}
          className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors p-1.5 rounded-lg cursor-pointer shrink-0"
          title="删除该条备忘"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

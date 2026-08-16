import React, { useState, useMemo } from 'react';
import { Trash2, Plus, Sparkles, ShieldAlert, Wrench, Compass, BookmarkCheck } from 'lucide-react';
import type { RiderMemory } from '../../types/rider';

interface Props {
  memories: RiderMemory[];
  onAddMemory: (category: string, content: string) => Promise<void>;
  onDeleteMemory: (id: number) => Promise<void>;
}

type FilterCategory = 'all' | 'health' | 'gear' | 'habit';

export default function MemoriesTab({ memories, onAddMemory, onDeleteMemory }: Props) {
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('all');
  const [newCategory, setNewCategory] = useState('health');
  const [newContent, setNewContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const filteredMemories = useMemo(() => {
    if (selectedFilter === 'all') return memories;
    if (selectedFilter === 'health') {
      return memories.filter(m => m.category === 'health' || m.category === 'physiology');
    }
    if (selectedFilter === 'gear') {
      return memories.filter(m => m.category === 'gear');
    }
    return memories.filter(m => m.category === 'habit' || m.category === 'preference' || m.category === 'coaching' || m.category === 'goal');
  }, [memories, selectedFilter]);

  const handleAdd = async () => {
    if (!newContent.trim() || isAdding) return;
    setIsAdding(true);
    try {
      await onAddMemory(newCategory, newContent.trim());
      setNewContent('');
    } finally {
      setIsAdding(false);
    }
  };

  const getCategoryMeta = (cat: string) => {
    if (cat === 'health' || cat === 'physiology') {
      return {
        label: '健康与安全底线',
        shortLabel: '健康底线',
        icon: ShieldAlert,
        color: 'bg-rose-50 text-rose-700 border-rose-200/80',
        cardBorder: 'hover:border-rose-300',
        badgeBg: 'bg-rose-100/70 text-rose-800'
      };
    }
    if (cat === 'gear') {
      return {
        label: '战车调校经验',
        shortLabel: '战车经验',
        icon: Wrench,
        color: 'bg-sky-50 text-sky-700 border-sky-200/80',
        cardBorder: 'hover:border-sky-300',
        badgeBg: 'bg-sky-100/70 text-sky-800'
      };
    }
    return {
      label: '习惯与训练偏好',
      shortLabel: '习惯偏好',
      icon: Compass,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
      cardBorder: 'hover:border-indigo-300',
      badgeBg: 'bg-indigo-100/70 text-indigo-800'
    };
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 [scrollbar-width:none]">
      {/* Intro Header */}
      <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/70">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>车手长期语义记忆与偏好画像 (Agentic Profile Memory)</span>
        </div>
        <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1">
          AI 教练在对话与实战中自动反思提炼的【持久原子事实】。每次生成训练指导或复盘时，均自动分层装配为高优先级先验约束。
        </p>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedFilter === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
          }`}
        >
          全部 ({memories.length})
        </button>
        <button
          onClick={() => setSelectedFilter('health')}
          className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
            selectedFilter === 'health'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'bg-rose-50 text-rose-700 hover:bg-rose-100/80 border border-rose-100'
          }`}
        >
          <ShieldAlert className="w-3 h-3" />
          <span>健康底线</span>
        </button>
        <button
          onClick={() => setSelectedFilter('gear')}
          className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
            selectedFilter === 'gear'
              ? 'bg-sky-700 text-white shadow-xs'
              : 'bg-sky-50 text-sky-700 hover:bg-sky-100/80 border border-sky-100'
          }`}
        >
          <Wrench className="w-3 h-3" />
          <span>战车调校</span>
        </button>
        <button
          onClick={() => setSelectedFilter('habit')}
          className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
            selectedFilter === 'habit'
              ? 'bg-indigo-700 text-white shadow-xs'
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100/80 border border-indigo-100'
          }`}
        >
          <Compass className="w-3 h-3" />
          <span>习惯偏好</span>
        </button>
      </div>

      {/* Atomic Memories List */}
      <div className="space-y-2.5">
        {filteredMemories.map((mem) => {
          const meta = getCategoryMeta(mem.category);
          const Icon = meta.icon;
          const isCoachExtracted = mem.source === 'coach' || mem.source === 'auto_extracted' || mem.source === 'coaching';

          return (
            <div
              key={mem.id}
              className={`p-3.5 bg-white hover:bg-slate-50/90 rounded-2xl border border-slate-200/90 ${meta.cardBorder} transition-all flex items-start justify-between gap-3 group shadow-2xs`}
            >
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border flex items-center space-x-1 ${meta.color}`}>
                    <Icon className="w-2.5 h-2.5" />
                    <span>{meta.shortLabel}</span>
                  </span>

                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    isCoachExtracted ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {isCoachExtracted ? '🤖 教练反思沉淀' : '👤 手动设定'}
                  </span>

                  <span className="text-[10px] text-slate-400 font-mono ml-auto">
                    {new Date((mem.created_at || Date.now() / 1000) * 1000).toLocaleDateString('zh-CN')}
                  </span>
                </div>

                <p className="text-xs font-semibold text-slate-800 leading-relaxed break-words">
                  {mem.content}
                </p>
              </div>

              <button
                onClick={() => onDeleteMemory(mem.id)}
                className="text-slate-300 hover:text-rose-600 transition-colors p-1.5 rounded-lg opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                title="删除该条事实"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {filteredMemories.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-xs font-medium bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
            该分类下暂无原子记忆条目。在与教练对话中提及身体感受或硬件配置，AI 将自动为你精炼沉淀。
          </div>
        )}
      </div>

      {/* Manual Memory Ingestion Bar */}
      <div className="pt-3 border-t border-slate-100 space-y-2.5">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
          <Plus className="w-3.5 h-3.5 text-slate-500" />
          <span>手动添加车手原子事实 (≤40字)</span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
          >
            <option value="health">🩺 健康与安全底线</option>
            <option value="gear">🚲 战车调校经验</option>
            <option value="habit">⏱️ 习惯与时空偏好</option>
            <option value="preference">🎯 训练风格偏好</option>
          </select>

          <input
            type="text"
            placeholder="例如：右膝曾有劳损，需维持85rpm以上高踏频..."
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          <button
            onClick={handleAdd}
            disabled={!newContent.trim() || isAdding}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0"
          >
            {isAdding ? '添加中...' : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
}

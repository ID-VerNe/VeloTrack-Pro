import React, { useState, useMemo } from 'react';
import { BookmarkCheck, ShieldAlert, Wrench, Compass } from 'lucide-react';
import type { RiderMemory } from '../../types/rider';
import MemoryItemCard from './MemoryItemCard';
import AddMemoryForm from './AddMemoryForm';

interface Props {
  memories: RiderMemory[];
  onAddMemory: (category: string, content: string) => Promise<void>;
  onDeleteMemory: (id: number) => Promise<void>;
}

type FilterCategory = 'all' | 'health' | 'gear' | 'habit';

export default function MemoriesTab({ memories, onAddMemory, onDeleteMemory }: Props) {
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

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

  const handleConfirmDelete = async (id: number) => {
    try {
      await onDeleteMemory(id);
    } finally {
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 [scrollbar-width:none]">
      {/* Intro Header */}
      <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/70">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
          <BookmarkCheck className="w-4 h-4 text-slate-700 shrink-0" />
          <span>车手习惯与身体备忘</span>
        </div>
        <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
          记录你平时随手提到的膝盖状况、齿比改件或骑行偏好。制定课表和推演配速时，都会先照着这些习惯来。
        </p>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedFilter === 'all'
              ? 'bg-brand-500 text-white shadow-xs'
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
          <span>身体底线</span>
        </button>
        <button
          onClick={() => setSelectedFilter('gear')}
          className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center space-x-1 transition-all cursor-pointer ${
            selectedFilter === 'gear'
              ? 'bg-brand-600 text-white shadow-xs'
              : 'bg-brand-50 text-brand-700 hover:bg-brand-100/80 border border-brand-100'
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
        {filteredMemories.map((mem) => (
          <MemoryItemCard
            key={mem.id}
            memory={mem}
            isConfirmingDelete={confirmDeleteId === mem.id}
            onRequestDelete={(id) => setConfirmDeleteId(id)}
            onConfirmDelete={handleConfirmDelete}
            onCancelDelete={() => setConfirmDeleteId(null)}
          />
        ))}

        {filteredMemories.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-xs font-medium bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
            该分类下暂无备忘条目。平时推演时聊到的身体感受或改件习惯，都会自动整理到这里。
          </div>
        )}
      </div>

      {/* Manual Memory Ingestion Bar */}
      <AddMemoryForm onAddMemory={onAddMemory} />
    </div>
  );
}

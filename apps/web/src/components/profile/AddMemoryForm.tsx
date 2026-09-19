import React, { useState } from 'react';
import { Plus } from 'lucide-react';

export interface AddMemoryFormProps {
  onAddMemory: (category: string, content: string) => Promise<void>;
}

export default function AddMemoryForm({ onAddMemory }: AddMemoryFormProps) {
  const [category, setCategory] = useState('health');
  const [content, setContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!content.trim() || isAdding) return;
    setIsAdding(true);
    try {
      await onAddMemory(category, content.trim());
      setContent('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="pt-3 border-t border-slate-100 space-y-2.5">
      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800">
        <Plus className="w-3.5 h-3.5 text-slate-500" />
        <span>手动添加身体或器材备忘</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="备忘分类"
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
        >
          <option value="health">健康与身体底线</option>
          <option value="gear">战车与配件经验</option>
          <option value="habit">骑行时段与路线习惯</option>
          <option value="preference">配速与训练偏好</option>
        </select>

        <input
          type="text"
          placeholder="例如：右膝曾有劳损，需维持 85rpm 以上高踏频..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
        />

        <button
          type="submit"
          disabled={!content.trim() || isAdding}
          className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 disabled:bg-slate-200 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 shadow-2xs"
        >
          {isAdding ? '添加中...' : '添加'}
        </button>
      </form>
    </div>
  );
}

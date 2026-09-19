import React, { useState } from 'react';
import { Sliders, Plus, Trash2 } from 'lucide-react';
import IconButton from '../common/IconButton';

interface Props {
  customSpecs: string | Record<string, any> | undefined;
  onChange: (updatedSpecs: Record<string, string>) => void;
}

export default function CustomSpecsEditor({ customSpecs, onChange }: Props) {
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  // 安全解析自定义规格对象
  const customSpecsObj: Record<string, string> = (() => {
    try {
      if (typeof customSpecs === 'string') {
        return JSON.parse(customSpecs || '{}');
      }
      if (typeof customSpecs === 'object' && customSpecs !== null) {
        return { ...customSpecs } as any;
      }
      return {};
    } catch {
      return {};
    }
  })();

  const handleAddCustomSpec = () => {
    if (!newKey.trim() || !newVal.trim()) return;
    const updated = { ...customSpecsObj, [newKey.trim()]: newVal.trim() };
    onChange(updated);
    setNewKey('');
    setNewVal('');
  };

  const handleDeleteCustomSpec = (keyToDelete: string) => {
    const updated = { ...customSpecsObj };
    delete updated[keyToDelete];
    onChange(updated);
  };

  const specKeys = Object.keys(customSpecsObj);

  return (
    <div className="pt-3 border-t border-slate-200/60 space-y-2">
      <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-700">
        <Sliders className="w-3.5 h-3.5 text-slate-500" />
        <span>自定义改装与配件参数 (键值对)</span>
      </div>

      {specKeys.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {specKeys.map((key) => (
            <span
              key={key}
              className="inline-flex items-center pl-2.5 pr-1 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-700 shadow-2xs gap-1"
            >
              <span className="text-slate-400 font-bold">{key}:</span>
              <span className="font-semibold text-slate-900">{customSpecsObj[key]}</span>
              <IconButton
                label={`删除 ${key}`}
                size="xs"
                danger
                onClick={() => handleDeleteCustomSpec(key)}
              >
                <Trash2 className="w-3 h-3" />
              </IconButton>
            </span>
          ))}
        </div>
      )}

      {/* 新增键值对输入条 */}
      <div className="flex items-center space-x-2 pt-1">
        <input
          id="profile_newkey"
          aria-label="新增自定义属性名"
          type="text"
          placeholder="属性名(如: 脚踏/轮组/码表)"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          className="w-1/3 px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <input
          id="profile_newval"
          aria-label="新增自定义属性值"
          type="text"
          placeholder="属性值(如: 平踏/20寸406/迈金C406)"
          value={newVal}
          onChange={(e) => setNewVal(e.target.value)}
          className="flex-1 px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={handleAddCustomSpec}
          disabled={!newKey.trim() || !newVal.trim()}
          className="px-3 py-1.5 bg-brand-500 hover:bg-brand-600 disabled:bg-slate-200 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center space-x-1 shadow-2xs"
        >
          <Plus className="w-3 h-3" />
          <span>添加</span>
        </button>
      </div>
    </div>
  );
}

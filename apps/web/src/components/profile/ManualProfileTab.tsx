import React, { useState } from 'react';
import { HeartPulse, Bike, AlertTriangle, Target, Plus, Trash2, Sliders, Cog, Disc } from 'lucide-react';
import type { RiderProfile } from '../../types/rider';
import IconButton from '../common/IconButton';

interface Props {
  profile: RiderProfile;
  onChange: (updated: RiderProfile) => void;
}

export default function ManualProfileTab({ profile, onChange }: Props) {
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const updateField = (field: keyof RiderProfile, value: any) => {
    onChange({ ...profile, [field]: value });
  };

  // Parse custom specs object safely
  const customSpecsObj: Record<string, string> = (() => {
    try {
      if (typeof profile.custom_specs === 'string') {
        return JSON.parse(profile.custom_specs || '{}');
      }
      if (typeof profile.custom_specs === 'object' && profile.custom_specs !== null) {
        return { ...profile.custom_specs } as any;
      }
      return {};
    } catch {
      return {};
    }
  })();

  const handleAddCustomSpec = () => {
    if (!newKey.trim() || !newVal.trim()) return;
    const updated = { ...customSpecsObj, [newKey.trim()]: newVal.trim() };
    updateField('custom_specs', updated);
    setNewKey('');
    setNewVal('');
  };

  const handleDeleteCustomSpec = (keyToDelete: string) => {
    const updated = { ...customSpecsObj };
    delete updated[keyToDelete];
    updateField('custom_specs', updated);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5 [scrollbar-width:none]">
      {/* Physiological Metrics Card */}
      <div className="bg-slate-50/80 rounded-2xl p-4.5 border border-slate-200/80 space-y-3.5 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
          <HeartPulse className="w-4 h-4 text-brand-500" />
          <span>生理与体能指标</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="profile_name" className="block text-xs font-semibold text-slate-500 mb-1">车手昵称</label>
            <input id="profile_name"
              type="text"
              value={profile.name || ''}
              onChange={(e) => updateField('name', e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              data-1p-ignore="true"
              data-lpignore="true"
              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-2xs"
            />
          </div>
          <div>
            <label htmlFor="profile_weight" className="block text-xs font-semibold text-slate-500 mb-1">体重 (kg，用于卡路里与功率)</label>
            <input id="profile_weight"
              type="number"
              step="0.5"
              value={profile.weight_kg || ''}
              onChange={(e) => updateField('weight_kg', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-2xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div>
            <label htmlFor="profile_maxhr" className="block text-xs font-semibold text-slate-500 mb-1">最大心率 (bpm)</label>
            <input id="profile_maxhr"
              type="number"
              value={profile.max_hr || ''}
              onChange={(e) => updateField('max_hr', parseInt(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs"
            />
          </div>
          <div>
            <label htmlFor="profile_resthr" className="block text-xs font-semibold text-slate-500 mb-1">静息心率 (bpm)</label>
            <input id="profile_resthr"
              type="number"
              value={profile.resting_hr || ''}
              onChange={(e) => updateField('resting_hr', parseInt(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs"
            />
          </div>
          <div>
            <label htmlFor="profile_ftp" className="block text-xs font-semibold text-slate-500 mb-1">FTP 功率 (W)</label>
            <input id="profile_ftp"
              type="number"
              value={profile.ftp_watts || ''}
              onChange={(e) => updateField('ftp_watts', parseInt(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Structured Bike & Hardware Card */}
      <div className="bg-slate-50/80 rounded-2xl p-4.5 border border-slate-200/80 space-y-3.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
            <Bike className="w-4 h-4 text-brand-500" />
            <span>主力战车与分立硬件配置</span>
          </div>
          <span className="text-xs text-slate-500 font-medium">各部件独立保存不丢失</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="profile_bike" className="block text-xs font-semibold text-slate-500 mb-1">主力战车型号</label>
            <input id="profile_bike"
              type="text"
              placeholder="例如：大行 P8 20寸折叠车"
              value={profile.current_bike || ''}
              onChange={(e) => updateField('current_bike', e.target.value)}
              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-2xs"
            />
          </div>
          <div>
            <label htmlFor="profile_bikeweight" className="block text-xs font-semibold text-slate-500 mb-1">战车整备重量 (kg)</label>
            <input id="profile_bikeweight"
              type="number"
              step="0.1"
              placeholder="11.5"
              value={profile.bike_weight_kg || ''}
              onChange={(e) => updateField('bike_weight_kg', parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-2xs"
            />
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <label htmlFor="profile_gears" className="block text-xs font-semibold text-slate-500 mb-1 flex items-center">
              <Cog className="w-3.5 h-3.5 mr-1 text-slate-500" aria-hidden="true" />
              <span>齿比与传动系统 (独立维护)</span>
            </label>
            <input id="profile_gears"
              type="text"
              placeholder="例如：46T牙盘 + 11-28T 7速飞轮"
              value={profile.gear_ratio || ''}
              onChange={(e) => updateField('gear_ratio', e.target.value)}
              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-2xs"
            />
          </div>

          <div>
            <label htmlFor="profile_tires" className="block text-xs font-semibold text-slate-500 mb-1 flex items-center">
              <Disc className="w-3.5 h-3.5 mr-1 text-slate-500" aria-hidden="true" />
              <span>外胎规格与建议胎压 (独立维护)</span>
            </label>
            <input id="profile_tires"
              type="text"
              placeholder="例如：马牌 Contact Urban 2.0 轮胎 (75-80 psi)"
              value={profile.tires || ''}
              onChange={(e) => updateField('tires', e.target.value)}
              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 shadow-2xs"
            />
          </div>
        </div>

        {/* Dynamic Arbitrary Custom Hardware Fields */}
        <div className="pt-2 border-t border-slate-200/60 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 flex items-center">
              <Sliders className="w-3.5 h-3.5 mr-1 text-brand-500" />
              <span>自定义改装/硬件参数扩展</span>
            </span>
            <span className="text-xs text-slate-500">支持自由添加任意字段</span>
          </div>

          {/* Existing Custom Specs Badges */}
          {Object.entries(customSpecsObj).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.entries(customSpecsObj).map(([key, val]) => (
                <span
                  key={key}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 font-medium shadow-2xs"
                >
                  <span className="text-slate-500">{key}:</span>
                  <span className="font-bold">{val}</span>
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

          {/* Add New Custom Field Input Row */}
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
      </div>

      {/* Health & Goals Card */}
      <div className="bg-slate-50/80 rounded-2xl p-4.5 border border-slate-200/80 space-y-3 shadow-2xs">
        <div className="flex items-center space-x-2 text-xs font-bold text-amber-700">
          <AlertTriangle className="w-4 h-4" />
          <span>既往旧伤与身体禁忌备忘</span>
        </div>
        <textarea
          rows={2}
          placeholder="例如：右膝半月板有劳损历史，需避免大齿比重踏..."
          value={profile.injuries_notes || ''}
          onChange={(e) => updateField('injuries_notes', e.target.value)}
          className="w-full px-3 py-2 bg-white rounded-xl border border-amber-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 shadow-2xs"
        />

        <div className="flex items-center space-x-2 text-xs font-bold text-emerald-700 pt-2 border-t border-slate-200/60">
          <Target className="w-4 h-4" />
          <span>阶段核心训练目标</span>
        </div>
        <textarea
          rows={2}
          placeholder="例如：市区巡航均速达到 20km/h，进阶 50km..."
          value={profile.primary_goal || ''}
          onChange={(e) => updateField('primary_goal', e.target.value)}
          className="w-full px-3 py-2 bg-white rounded-xl border border-emerald-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-2xs"
        />
      </div>
    </div>
  );
}

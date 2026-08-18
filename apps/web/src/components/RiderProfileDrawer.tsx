import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Check 
} from 'lucide-react';
import InterviewTab from './profile/InterviewTab';
import ManualProfileTab from './profile/ManualProfileTab';
import MemoriesTab from './profile/MemoriesTab';
import type { RiderProfile, RiderMemory } from '../types/rider';
import { useDialog } from '../hooks/useDialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function RiderProfileDrawer({ isOpen, onClose }: Props) {
  // 弹层无障碍：焦点陷阱 + Esc 关闭 + 关闭后焦点返还
  const dialogRef = useDialog(isOpen, onClose);
  const [activeTab, setActiveTab] = useState<'manual' | 'interview' | 'memories'>('manual');
  const [profile, setProfile] = useState<RiderProfile>({
    name: 'VerNe Yuu',
    gender: 'male',
    weight_kg: 75,
    height_cm: 173,
    max_hr: 188,
    resting_hr: 55,
    ftp_watts: 165,
    current_bike: '大行 P8',
    gear_ratio: '46T牙盘 + 11-28T 7速飞轮',
    tires: '马牌 Contact Urban 2.0 轮胎 (75-80 psi)',
    bike_weight_kg: 11.5,
    bike_specs: '46T牙盘 + 11-28T 7速飞轮 | 马牌 Contact Urban 2.0 轮胎',
    custom_specs: '{"pedals": "平踏", "wheelset": "20寸406"}',
    injuries_notes: '右膝半月板轻微劳损史，需维持85-95rpm高踏频防护',
    primary_goal: '',
  });
  const [memories, setMemories] = useState<RiderMemory[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Silent update that NEVER unmounts tabs or resets chat
  const fetchProfileAndMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/rider/profile');
      const data = await res.json();
      if (data.profile) setProfile(data.profile);
      if (data.memories) setMemories(data.memories);
    } catch (err) {
      console.error('Failed to load profile:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchProfileAndMemories();
    }
  }, [isOpen, fetchProfileAndMemories]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/ai/rider/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMemory = async (category: string, content: string) => {
    const slugKey = `manual_${category}_${Date.now().toString().slice(-6)}`;
    const res = await fetch('/api/ai/rider/memories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category,
        memory_key: slugKey,
        content,
        source: 'manual',
        importance: 4,
      }),
    });
    if (res.ok) {
      await fetchProfileAndMemories();
    }
  };

  const handleDeleteMemory = async (id: number) => {
    const res = await fetch(`/api/ai/rider/memories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setMemories((prev) => prev.filter((m) => m.id !== id));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in select-none">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="车手与战车档案舱"
        tabIndex={-1}
        className="w-full max-w-[540px] bg-white h-full flex flex-col border-l border-slate-200/80 animate-in slide-in-from-right duration-200 focus:outline-none"
      >
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold text-slate-900 leading-tight">车手与战车档案舱</h2>
              <span className="text-[10px] font-mono bg-slate-50 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded">
                {profile.weight_kg} kg
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 truncate max-w-[320px] mt-0.5">
              {profile.current_bike || '大行 P8'} · {profile.primary_goal || '巡航 20km/h'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded transition-colors cursor-pointer"
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Control Tabs */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-100 shrink-0 font-mono">
          <div className="border border-slate-200 p-0.5 rounded flex space-x-0.5 text-xs">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-1 rounded transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-slate-900 text-white font-medium'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>档案与传动</span>
            </button>

            <button
              onClick={() => setActiveTab('interview')}
              className={`flex-1 py-1 rounded transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'interview'
                  ? 'bg-slate-900 text-white font-medium'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>快速配置向导</span>
            </button>

            <button
              onClick={() => setActiveTab('memories')}
              className={`flex-1 py-1 rounded transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'memories'
                  ? 'bg-slate-900 text-white font-medium'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>习惯与身体备忘</span>
              <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                activeTab === 'memories' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {memories.length}
              </span>
            </button>
          </div>
        </div>

        {/* Tab 1: Manual Profile Editing */}
        <div className={`flex-1 flex flex-col min-h-0 ${activeTab === 'manual' ? 'flex' : 'hidden'}`}>
          <ManualProfileTab
            profile={profile}
            onChange={setProfile}
          />
          <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-end space-x-3 shrink-0 font-mono">
            {saveSuccess && (
              <span className="text-xs text-slate-900 flex items-center font-medium">
                <Check className="w-3.5 h-3.5 mr-1" /> 已保存
              </span>
            )}
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded text-xs cursor-pointer transition-colors"
            >
              {isSaving ? '正在保存...' : '保存修改'}
            </button>
          </div>
        </div>

        {/* Tab 2: Conversational Interview Agent (Persists state) */}
        <div className={`flex-1 flex flex-col min-h-0 ${activeTab === 'interview' ? 'flex' : 'hidden'}`}>
          <InterviewTab
            profile={profile}
            onProfileUpdated={() => fetchProfileAndMemories()}
          />
        </div>

        {/* Tab 3: Agentic Semantic Profile Memories */}
        <div className={`flex-1 flex flex-col min-h-0 ${activeTab === 'memories' ? 'flex' : 'hidden'}`}>
          <MemoriesTab
            memories={memories}
            onAddMemory={handleAddMemory}
            onDeleteMemory={handleDeleteMemory}
          />
        </div>
      </div>
    </div>
  );
}

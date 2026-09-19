import React from 'react';
import { 
  X, 
  Check 
} from 'lucide-react';
import InterviewTab from './profile/InterviewTab';
import ManualProfileTab from './profile/ManualProfileTab';
import MemoriesTab from './profile/MemoriesTab';
import AIGatewayConfigTab from './profile/AIGatewayConfigTab';
import { useDialog } from '../hooks/useDialog';
import { useRiderProfileDrawer } from '../hooks/useRiderProfileDrawer';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function RiderProfileDrawer({ isOpen, onClose }: Props) {
  // 弹层无障碍：焦点陷阱 + Esc 关闭 + 关闭后焦点返还
  const dialogRef = useDialog(isOpen, onClose);
  const {
    activeTab,
    setActiveTab,
    profile,
    setProfile,
    memories,
    isSaving,
    saveSuccess,
    saveError,
    fetchProfileAndMemories,
    handleSaveProfile,
    handleAddMemory,
    handleDeleteMemory,
  } = useRiderProfileDrawer(isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="车手与战车档案舱"
        tabIndex={-1}
        className="w-full sm:w-[480px] bg-white h-full flex flex-col border-l border-slate-200/80 animate-in slide-in-from-right duration-200 focus:outline-none"
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
                  ? 'bg-brand-500 text-white font-medium shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>档案与传动</span>
            </button>

            <button
              onClick={() => setActiveTab('interview')}
              className={`flex-1 py-1 rounded transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'interview'
                  ? 'bg-brand-500 text-white font-medium shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>快速配置向导</span>
            </button>

            <button
              onClick={() => setActiveTab('memories')}
              className={`flex-1 py-1 rounded transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'memories'
                  ? 'bg-brand-500 text-white font-medium shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>习惯与身体备忘</span>
              <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                activeTab === 'memories' ? 'bg-brand-700 text-brand-100' : 'bg-slate-100 text-slate-600'
              }`}>
                {memories.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('gateway')}
              className={`flex-1 py-1 rounded transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                activeTab === 'gateway'
                  ? 'bg-brand-500 text-white font-medium shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>AI 接入</span>
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
            {saveError && (
              <span className="text-xs text-rose-600 flex items-center font-medium">
                {saveError}
              </span>
            )}
            {saveSuccess && (
              <span className="text-xs text-slate-900 flex items-center font-medium">
                <Check className="w-3.5 h-3.5 mr-1" /> 已保存
              </span>
            )}
            <button
              onClick={handleSaveProfile}
              disabled={isSaving}
              className="px-4 py-1.5 bg-brand-500 hover:bg-brand-600 active:bg-brand-700 disabled:bg-slate-200 text-white rounded text-xs cursor-pointer transition-colors shadow-2xs"
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

        {/* Tab 4: AI Gateway config (base_url / model_name 后端，team key localStorage) */}
        <div className={`flex-1 flex flex-col min-h-0 ${activeTab === 'gateway' ? 'flex' : 'hidden'}`}>
          <AIGatewayConfigTab />
        </div>
      </div>
    </div>
  );
}

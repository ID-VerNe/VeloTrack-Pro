import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  RefreshCw, 
  Trash2, 
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  X
} from 'lucide-react';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatMessageItem from '../components/chat/ChatMessageItem';
import ChatComposer from '../components/chat/ChatComposer';
import ConfirmModal from '../components/common/ConfirmModal';
import { useCoachChat, SUGGESTED_PROMPTS } from '../hooks/useCoachChat';

export default function AICoach() {
  const [searchParams] = useSearchParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const {
    sessionId,
    sessions,
    messages,
    input,
    setInput,
    isLoading,
    riderInfo,
    toast,
    setToast,
    sessionToDelete,
    deleteError,
    messagesEndRef,
    handleSelectSession,
    handleNewSession,
    handleRequestDeleteSession,
    cancelDeleteSession,
    handleConfirmDeleteSession,
    handleSend,
    handleRegenerate,
  } = useCoachChat({ initialPrompt: searchParams.get('prompt') });

  return (
    <div className="h-full w-full bg-[#F8FAFC] flex flex-col text-slate-900 overflow-hidden select-none">
      <div className="flex-1 flex overflow-hidden min-w-0">
        {/* Left Column: Collapsible Chat Sessions Sidebar */}
        <ChatSidebar
          isOpen={isSidebarOpen}
          sessionId={sessionId}
          sessions={sessions}
          riderWeight={riderInfo.weight}
          riderBike={riderInfo.bike}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleRequestDeleteSession}
          onOpenProfile={() => window.dispatchEvent(new CustomEvent('open-profile'))}
        />

        {/* Center Main Workspace */}
        <main className="flex-1 h-full flex flex-col bg-white overflow-hidden min-w-0 relative">
          {/* Floating Toast Notification */}
          {toast && (
            <div 
              role="status" 
              aria-live="polite" 
              className="absolute top-16 right-6 z-50 bg-brand-900 text-white p-3.5 rounded border border-brand-800 shadow-lg animate-in slide-in-from-top-3 duration-200 flex items-center space-x-3 max-w-md font-mono"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium leading-tight">{toast.title}</div>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{toast.desc}</p>
              </div>
              {toast.link ? (
                <Link
                  to={toast.link}
                  className="px-2.5 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition-colors shrink-0"
                >
                  查看
                </Link>
              ) : (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('open-profile'))}
                  className="px-2.5 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition-colors shrink-0 cursor-pointer"
                >
                  查看
                </button>
              )}
              <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white p-1 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Top Sticky Header */}
          <header className="h-14 px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white z-10">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                title={isSidebarOpen ? '收起历史列表' : '展开历史列表'}
              >
                {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>

              <div className="flex items-center space-x-2">
                <h1 className="text-xs font-semibold text-slate-900">训练推演助手</h1>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">
                  {sessionId === 'coach_main' ? '主方案' : '专项推演'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2 font-mono">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent('open-profile'))}
                className="px-2.5 py-1 rounded bg-white hover:bg-slate-50 text-slate-700 text-xs border border-slate-200 transition-colors cursor-pointer flex items-center space-x-1.5 shadow-2xs"
              >
                <SlidersHorizontal className="w-3 h-3 text-slate-400" />
                <span>车手档案 ({riderInfo.weight}kg)</span>
              </button>

              <button
                type="button"
                onClick={() => handleRequestDeleteSession(sessionId)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                title="清空当前推演会话"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {/* Centered Messages Stream */}
          <div className="flex-1 overflow-y-auto px-4 py-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  isLoading={isLoading}
                  onRegenerate={handleRegenerate}
                  onOpenProfile={() => window.dispatchEvent(new CustomEvent('open-profile'))}
                />
              ))}

              {isLoading && (
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-brand-500 text-white flex items-center justify-center shrink-0 text-xs font-bold font-mono shadow-2xs">
                    VT
                  </div>
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl rounded-tl-sm px-4 py-3 text-xs text-slate-700 font-medium flex items-center space-x-2.5 shadow-xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-700" />
                    <span>正在综合战车传动比与骑行遥测数据推演方案...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Bottom Floating Composer */}
          <ChatComposer
            input={input}
            isLoading={isLoading}
            suggestedPrompts={SUGGESTED_PROMPTS}
            onInputChange={setInput}
            onSend={handleSend}
          />
        </main>
      </div>

      {/* In-App Delete Session Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(sessionToDelete)}
        title="清空推演会话"
        description="确定要清空该推演会话的历史记录吗？清空后该推演会话的历史消息将被清除，但已沉淀的车手档案与目标记忆不会受到影响。"
        confirmText="确认清空"
        cancelText="取消"
        isDanger={true}
        errorMessage={deleteError}
        onConfirm={handleConfirmDeleteSession}
        onClose={cancelDeleteSession}
      />
    </div>
  );
}

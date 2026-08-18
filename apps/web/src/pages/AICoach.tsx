import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  RefreshCw, 
  Trash2, 
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  X
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import RiderProfileDrawer from '../components/RiderProfileDrawer';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatMessageItem from '../components/chat/ChatMessageItem';
import ChatComposer from '../components/chat/ChatComposer';
import type { ChatMessage, SessionSummary } from '../types/rider';

const SUGGESTED_PROMPTS = [
  '测算大行P8在46T齿比下平路巡航20km/h的推荐踏频与档位',
  '结合近期实战双均速与负荷，评估下一阶段周里程与均速目标',
  '评估大齿比爬坡对右膝半月板的受力影响与降档节奏',
  '对比深圳湾与二沙岛等路线的巡航做功特征与心率恢复',
];

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '### 战术与生理诊断就绪\n\n已装载 **大行 P8 (46T/11-28T)** 传动系统参数与近期骑行遥测数据库。\n\n可直接输入训练诉求进行 **齿比配速推演**、**心肺与踏频负荷诊断** 或 **自适应周目标调整**。',
};

export default function AICoach() {
  const [searchParams] = useSearchParams();
  const [sessionId, setSessionId] = useState<string>(() => {
    return localStorage.getItem('velotrack_coach_session_id') || 'coach_main';
  });

  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [riderInfo, setRiderInfo] = useState<{ weight: number; bike: string }>({ weight: 75, bike: '大行 P8' });

  // Floating Toast Notification State
  const [toast, setToast] = useState<{ title: string; desc: string; type: 'goal' | 'profile'; link?: string } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessionMessages = useCallback(async (sid: string) => {
    try {
      const res = await fetch(`/api/ai/coach/${sid}/messages`);
      const data = await res.json();
      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
      } else {
        setMessages([DEFAULT_WELCOME_MSG]);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, []);

  const loadSessionsList = async () => {
    try {
      const res = await fetch('/api/ai/coach/sessions');
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const fetchRiderInfo = async () => {
    try {
      const res = await fetch('/api/ai/rider/profile');
      const data = await res.json();
      if (data.profile) {
        setRiderInfo({
          weight: data.profile.weight_kg || 75,
          bike: data.profile.current_bike || '大行 P8',
        });
      }
    } catch {}
  };

  useEffect(() => {
    localStorage.setItem('velotrack_coach_session_id', sessionId);
    loadSessionMessages(sessionId);
    loadSessionsList();
    fetchRiderInfo();
  }, [sessionId, loadSessionMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const handleSelectSession = (sid: string) => {
    setSessionId(sid);
  };

  const handleNewSession = () => {
    const newId = `session_${Date.now()}`;
    setSessionId(newId);
    setMessages([DEFAULT_WELCOME_MSG]);
  };

  const handleRequestDeleteSession = (sid = sessionId) => {
    setSessionToDelete(sid);
  };

  const handleConfirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    const sid = sessionToDelete;
    setSessionToDelete(null);
    try {
      await fetch(`/api/ai/coach/${sid}`, { method: 'DELETE' });
      if (sid === sessionId) {
        setMessages([DEFAULT_WELCOME_MSG]);
      }
      await loadSessionsList();
    } catch (err) {
      console.error(err);
    }
  };

  const hasTriggeredPromptRef = useRef(false);
  const initialPrompt = searchParams.get('prompt');

  const handleSend = useCallback(async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: query.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`/api/ai/coach/${sessionId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query.trim() }),
      });

      const data = await res.json();
      const reply = data.reply || '';
      if (!res.ok || !reply || reply.includes('未能获取回复') || reply.includes('异常')) {
        setMessages((prev) => [
          ...prev,
          {
            id: `error_${Date.now()}`,
            role: 'assistant',
            content: reply || '未能获取完整回复，请点击下方「重新生成」重试。',
            isError: true,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: reply,
            tool_calls: data.toolCalls,
          },
        ]);

        // Trigger prominent toast if goals or profile updated
        if (data.goalUpdated) {
          setToast({
            type: 'goal',
            title: '目标与周程指标已更新',
            desc: '已同步至系统目标看板，周目标与巡航基准已生效。',
            link: '/goals',
          });
          setTimeout(() => setToast(null), 5000);
        } else if (data.profileUpdated) {
          setToast({
            type: 'profile',
            title: '车手档案与硬件配置已更新',
            desc: '车辆参数与齿比配置已更新。',
          });
          setTimeout(() => setToast(null), 5000);
        }
      }
      await loadSessionsList();
      await fetchRiderInfo();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: '连接分析服务时发生网络异常，请点击「重新生成」重试。',
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, sessionId]);

  useEffect(() => {
    if (initialPrompt && !hasTriggeredPromptRef.current && !isLoading) {
      hasTriggeredPromptRef.current = true;
      handleSend(initialPrompt);
    }
  }, [initialPrompt, isLoading, handleSend]);

  const handleRegenerate = async () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg?.content) return;

    setMessages((prev) => {
      const next = [...prev];
      if (next.length > 1 && next[next.length - 1].role === 'assistant') {
        next.pop();
      }
      return next;
    });

    await handleSend(lastUserMsg.content);
  };

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] font-sans flex text-slate-900 overflow-hidden select-none">
      <Sidebar />

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
          onOpenProfile={() => setIsProfileOpen(true)}
        />

        {/* Center Main Workspace */}
        <main className="flex-1 h-full flex flex-col bg-white overflow-hidden min-w-0 relative">
          {/* Floating Toast Notification */}
          {toast && (
            <div className="absolute top-16 right-6 z-50 bg-slate-900 text-white p-3.5 rounded border border-slate-800 shadow-lg animate-in slide-in-from-top-3 duration-200 flex items-center space-x-3 max-w-md font-mono">
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
                  onClick={() => setIsProfileOpen(true)}
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
                onClick={() => setIsProfileOpen(true)}
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
                  onOpenProfile={() => setIsProfileOpen(true)}
                />
              ))}

              {isLoading && (
                <div className="flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 text-xs font-bold font-mono">
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

      {/* Slide-over Rider Profile & Onboarding Interview Drawer */}
      <RiderProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => {
          setIsProfileOpen(false);
          fetchRiderInfo();
        }}
      />

      {/* In-App Delete Session Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4 animate-in fade-in select-none">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">清空推演会话</h3>
                <p className="text-xs text-slate-500 mt-0.5">确定要清空该推演会话的历史记录吗？</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
              清空后该推演会话的历史消息将被清除，但已沉淀的车手档案与目标记忆不会受到影响。
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSession}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

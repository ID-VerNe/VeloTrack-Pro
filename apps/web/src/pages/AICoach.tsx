import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { 
  RefreshCw, 
  Trash2, 
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  Target,
  X
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import RiderProfileDrawer from '../components/RiderProfileDrawer';
import ChatSidebar from '../components/chat/ChatSidebar';
import ChatMessageItem from '../components/chat/ChatMessageItem';
import ChatComposer from '../components/chat/ChatComposer';
import type { ChatMessage, SessionSummary } from '../types/rider';

const SUGGESTED_PROMPTS = [
  '⚡ 平路巡航 20km/h 进阶：测算 46T 牙盘最佳踏频与齿比档位',
  '🎯 阶段训练目标重设：结合近期负荷生成下一周期公里数与均速',
  '🦵 膝关节生物力学诊断：评估大齿比做功负荷与踏频漂移风险',
  '📈 深圳/广州多路线巡航做功对比与心肺恢复评估',
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

  const handleSelectSession = (sid: string) => {
    setSessionId(sid);
  };

  const handleNewSession = () => {
    const newId = `session_${Date.now()}`;
    setSessionId(newId);
    setMessages([DEFAULT_WELCOME_MSG]);
  };

  const handleClearSession = async (sid = sessionId) => {
    if (!window.confirm('确定要清空该对话历史吗？')) return;
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

  const handleSend = async (textToSend?: string) => {
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
          const g = data.goalUpdated;
          setToast({
            type: 'goal',
            title: '🎯 训练目标已自动同步至系统',
            desc: `单周目标 ${g.weekly_distance_km || 50}km · 巡航均速 ${g.target_avg_speed_kmh || 16}km/h · 月度 ${g.monthly_distance_km || 170}km`,
            link: '/goals',
          });
          setTimeout(() => setToast(null), 5000);
        } else if (data.profileUpdated) {
          setToast({
            type: 'profile',
            title: '🚲 车手档案与硬件配置已更新',
            desc: '分立硬件属性已成功保存至数据库并保留既有配件。',
          });
          setTimeout(() => setToast(null), 5000);
        }
      }
      await loadSessionsList();
      await fetchRiderInfo();
    } catch (err: any) {
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
  };

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
          onDeleteSession={handleClearSession}
          onOpenProfile={() => setIsProfileOpen(true)}
        />

        {/* Center Main Workspace */}
        <main className="flex-1 h-full flex flex-col bg-white overflow-hidden min-w-0 relative">
          {/* Floating Toast Notification */}
          {toast && (
            <div className="absolute top-16 right-6 z-50 bg-slate-900/95 text-white p-3.5 rounded-2xl shadow-xl border border-white/10 backdrop-blur-md animate-in slide-in-from-top-3 duration-200 flex items-center space-x-3 max-w-md">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${toast.type === 'goal' ? 'bg-emerald-500' : 'bg-blue-500'}`}>
                {toast.type === 'goal' ? <Target className="w-4 h-4 text-white" /> : <CheckCircle2 className="w-4 h-4 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold leading-tight">{toast.title}</div>
                <p className="text-[11px] text-slate-300 truncate mt-0.5">{toast.desc}</p>
              </div>
              {toast.link ? (
                <Link
                  to={toast.link}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-all shrink-0"
                >
                  查看
                </Link>
              ) : (
                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
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
          <header className="h-14 px-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/90 backdrop-blur-md z-10">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title={isSidebarOpen ? '收起历史列表' : '展开历史列表'}
              >
                {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </button>

              <div className="flex items-center space-x-2">
                <h1 className="text-sm font-bold text-slate-900">训练决策舱</h1>
                <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-semibold">
                  {sessionId === 'coach_main' ? '主方案流' : '专项推演'}
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/80 transition-colors cursor-pointer flex items-center space-x-1.5 shadow-2xs"
              >
                <SlidersHorizontal className="w-3 h-3 text-slate-600" />
                <span>车手档案 ({riderInfo.weight}kg)</span>
              </button>

              <button
                type="button"
                onClick={() => handleClearSession()}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                title="清空当前推演记录"
              >
                <Trash2 className="w-4 h-4" />
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
    </div>
  );
}

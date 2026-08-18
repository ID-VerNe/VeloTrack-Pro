import React, { useState, useRef, useEffect } from 'react';
import { User, Send, RefreshCw, CheckCircle2 } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import type { RiderProfile } from '../../types/rider';

interface Props {
  profile: RiderProfile;
  onProfileUpdated: () => void;
}

interface InterviewMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  updatedFields?: any;
}

const DEFAULT_INTERVIEW_WELCOME: InterviewMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '### 车手与硬件配置向导就绪\n\n可直接输入身体指标或战车改件（例如：“更新 46T 牙盘 + 11-28T 7速飞轮”、“已换装马牌 2.0 外胎，胎压 75psi”），系统将对数据库进行 **分立硬件局部精准维护**，完整保留既有配件。',
};

export default function InterviewTab({ profile, onProfileUpdated }: Props) {
  const [messages, setMessages] = useState<InterviewMessage[]>([DEFAULT_INTERVIEW_WELCOME]);
  const [input, setInput] = useState('');
  const [isInterviewing, setIsInterviewing] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState<string[]>([]);
  const interviewEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    interviewEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isInterviewing]);

  const handleSend = async (quickText?: string) => {
    const text = quickText || input;
    if (!text.trim() || isInterviewing) return;

    const userMsg: InterviewMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!quickText) setInput('');
    setIsInterviewing(true);

    try {
      const res = await fetch('/api/ai/rider/interview/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          history: messages,
        }),
      });

      const data = await res.json();
      const assistantMsg: InterviewMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.reply || '已记录并更新。',
        updatedFields: data.updatedFields && Object.keys(data.updatedFields).length > 0 ? data.updatedFields : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (data.updatedFields && Object.keys(data.updatedFields).length > 0) {
        const fields = Object.keys(data.updatedFields);
        setRecentlyUpdated(fields);
        setTimeout(() => setRecentlyUpdated([]), 5000);
        onProfileUpdated();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsInterviewing(false);
    }
  };

  const [isComposing, setIsComposing] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Compact HUD Status Bar */}
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-slate-700 font-mono">已生效核心参数 HUD</span>
          {recentlyUpdated.length > 0 ? (
            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center animate-pulse shadow-2xs font-mono">
              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
              已写入数据库: {recentlyUpdated.join(', ')}
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-medium">分立硬件局部精准维护</span>
          )}
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500 text-xs font-semibold">体重</div>
            <div className="font-bold text-slate-900 truncate font-mono">{profile.weight_kg} kg</div>
          </div>
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500 text-xs font-semibold">车型 / 车重</div>
            <div className="font-bold text-slate-900 truncate" title={`${profile.current_bike} (${profile.bike_weight_kg || 11.5}kg)`}>
              {profile.current_bike?.split(' ')[0] || '大行P8'} · {profile.bike_weight_kg || 11.5}kg
            </div>
          </div>
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500 text-xs font-semibold">齿比 / 外胎</div>
            <div className="font-bold text-slate-900 truncate text-xs" title={`${profile.gear_ratio || '46T/11-28T'} | ${profile.tires || '马牌2.0'}`}>
              {profile.gear_ratio?.split(' ')[0] || '46T/11-28T'} · 马牌2.0
            </div>
          </div>
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-slate-500 text-xs font-semibold">伤病状态</div>
            <div className="font-bold text-slate-700 truncate" title={profile.injuries_notes}>
              {profile.injuries_notes && !profile.injuries_notes.includes('无') ? '已登记' : '暂无伤病'}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start space-x-2.5 ${m.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold font-mono ${
                m.role === 'user'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-800 text-slate-100 shadow-xs border border-slate-700'
              }`}
            >
              {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : 'VT'}
            </div>

            <div
              className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed space-y-2.5 ${
                m.role === 'user'
                  ? 'bg-slate-900 text-white font-medium shadow-xs rounded-tr-xs whitespace-pre-line'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs shadow-xs'
              }`}
            >
              {/* Highlight Confirmation Card inside Assistant Bubble if updated */}
              {m.role === 'assistant' && m.updatedFields && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center space-x-2 text-emerald-950 font-bold shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="flex-1 min-w-0 text-xs">
                    <span>✅ 数据已同步写入数据库：</span>
                    <span className="font-extrabold text-emerald-800 ml-1">
                      {Object.keys(m.updatedFields).join(', ')}
                    </span>
                  </div>
                </div>
              )}

              {m.role === 'user' ? m.content : <MarkdownRenderer content={m.content} />}
            </div>
          </div>
        ))}

        {isInterviewing && (
          <div className="flex items-center space-x-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 w-fit shadow-2xs">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-700" />
            <span>正在更新战车分立硬件配置...</span>
          </div>
        )}
        <div ref={interviewEndRef} />
      </div>

      {/* Bottom Composer & Quick Chips */}
      <div className="p-4 bg-white border-t border-slate-200 shrink-0 space-y-2.5">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          <button
            onClick={() => handleSend('我的车齿比改成了46T牙盘+11-28T 7速飞轮')}
            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs shrink-0 cursor-pointer"
          >
            ⚙️ 更新46T/11-28T齿比
          </button>
          <button
            onClick={() => handleSend('外胎保持马牌 contact urban 2.0 轮胎，胎压75-80psi')}
            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs shrink-0 cursor-pointer"
          >
            🛞 确认马牌2.0外胎
          </button>
          <button
            onClick={() => handleSend('我给车加装了平踏，整车重量11.5kg')}
            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs shrink-0 cursor-pointer"
          >
            🚲 更新车重与脚踏
          </button>
          <button
            onClick={() => handleSend('膝盖暂无伤病，保持85+rpm高踏频')}
            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 shadow-2xs shrink-0 cursor-pointer"
          >
            🩹 确认健康状态
          </button>
        </div>

        <div className="relative bg-white rounded-xl border border-slate-300 shadow-xs focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 transition-all flex items-center p-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (isComposing || (e.nativeEvent as any).isComposing) return;
                handleSend();
              }
            }}
            placeholder="输入你的硬件或身体参数（如：我改了46T牙盘，外胎仍是马牌2.0）..."
            className="flex-1 px-2.5 py-1 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
            disabled={isInterviewing}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isInterviewing}
            className="p-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded-lg cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

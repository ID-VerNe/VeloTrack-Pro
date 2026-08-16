import React from 'react';
import { Plus, Trash2, MessageSquare, SlidersHorizontal } from 'lucide-react';
import type { SessionSummary } from '../../types/rider';

interface Props {
  isOpen: boolean;
  sessionId: string;
  sessions: SessionSummary[];
  riderWeight: number;
  riderBike: string;
  onSelectSession: (sid: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sid: string) => void;
  onOpenProfile: () => void;
}

export default function ChatSidebar({
  isOpen,
  sessionId,
  sessions,
  riderWeight,
  riderBike,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onOpenProfile,
}: Props) {
  if (!isOpen) return null;

  const now = Date.now();
  const oneDay = 24 * 3600 * 1000;
  const groups: { [key: string]: SessionSummary[] } = {
    '今日推演': [],
    '昨日': [],
    '近 7 天': [],
    '更早之前': [],
  };

  sessions.forEach((s) => {
    const diff = now - (s.last_activity ? s.last_activity * 1000 : now);
    if (diff < oneDay) {
      groups['今日推演'].push(s);
    } else if (diff < 2 * oneDay) {
      groups['昨日'].push(s);
    } else if (diff < 7 * oneDay) {
      groups['近 7 天'].push(s);
    } else {
      groups['更早之前'].push(s);
    }
  });

  return (
    <aside className="w-64 bg-slate-50/90 border-r border-slate-200/80 flex flex-col justify-between shrink-0 h-full select-none animate-in slide-in-from-left duration-150">
      {/* Top New Session Button */}
      <div className="p-3.5 border-b border-slate-200/70">
        <button
          type="button"
          onClick={onNewSession}
          className="w-full px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200 shadow-xs transition-all active:scale-98 cursor-pointer flex items-center justify-between group"
        >
          <div className="flex items-center space-x-2">
            <Plus className="w-4 h-4 text-slate-900 group-hover:scale-110 transition-transform" />
            <span>开启新专项推演</span>
          </div>
        </button>
      </div>

      {/* Session Group List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-4 [scrollbar-width:none]">
        {Object.entries(groups).map(([groupTitle, list]) => {
          if (list.length === 0) return null;
          return (
            <div key={groupTitle} className="space-y-1">
              <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {groupTitle}
              </div>
              {list.map((s) => {
                const isCurrent = s.session_id === sessionId;
                return (
                  <div
                    key={s.session_id}
                    onClick={() => onSelectSession(s.session_id)}
                    className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-slate-900 text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0 flex-1">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isCurrent ? 'text-sky-400' : 'text-slate-400'}`} />
                      <span className="truncate">
                        {s.first_question || (s.session_id === 'coach_main' ? '全域诊断主方案' : '专项推演')}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(s.session_id);
                      }}
                      className={`text-slate-400 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded cursor-pointer ${isCurrent ? 'hover:text-rose-300' : ''}`}
                      title="删除该推演"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-xs font-medium">
            暂无历史推演
          </div>
        )}
      </div>

      {/* Bottom Profile Status Bar */}
      <div className="p-3 border-t border-slate-200/70 bg-slate-100/50">
        <div 
          onClick={onOpenProfile}
          className="flex items-center justify-between p-2 rounded-xl hover:bg-white transition-all cursor-pointer border border-transparent hover:border-slate-200 shadow-2xs"
        >
          <div className="flex items-center space-x-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold font-mono">
              V
            </div>
            <div className="truncate text-[11px] font-bold text-slate-700">
              {riderBike} · {riderWeight}kg
            </div>
          </div>
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </aside>
  );
}

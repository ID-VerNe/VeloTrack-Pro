import React from 'react';
import { Plus, Trash2, SlidersHorizontal } from 'lucide-react';
import type { SessionSummary } from '../../types/rider';
import IconButton from '../common/IconButton';

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
    <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between shrink-0 h-full select-none animate-in slide-in-from-left duration-150">
      {/* Top New Session Button */}
      <div className="p-4 border-b border-slate-100">
        <button
          type="button"
          onClick={onNewSession}
          className="w-full px-3 py-2 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono transition-colors cursor-pointer flex items-center justify-center space-x-2"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>开启新推演会话</span>
        </button>
      </div>

      {/* Session Group List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 [scrollbar-width:none]">
        {Object.entries(groups).map(([groupTitle, list]) => {
          if (list.length === 0) return null;
          return (
            <div key={groupTitle} className="space-y-1">
              <div className="px-2 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                {groupTitle}
              </div>
              {list.map((s) => {
                const isCurrent = s.session_id === sessionId;
                return (
                  <div
                    key={s.session_id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isCurrent}
                    onClick={() => onSelectSession(s.session_id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectSession(s.session_id);
                      }
                    }}
                    className={`group flex items-center justify-between px-3 py-2 rounded text-xs transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-slate-100 text-slate-900 font-medium border-l-2 border-slate-900 rounded-l-none'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <span className="truncate block">
                        {s.first_question || (s.session_id === 'coach_main' ? '全域诊断主会话' : '推演会话')}
                      </span>
                    </div>

                    <IconButton
                      label="删除该会话"
                      size="xs"
                      danger
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(s.session_id);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-600" />
                    </IconButton>
                  </div>
                );
              })}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="text-center py-10 text-slate-400 text-xs font-mono">
            暂无历史推演
          </div>
        )}
      </div>

      {/* Bottom Profile Status Bar */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label={`打开骑手档案（${riderBike} · ${riderWeight}kg）`}
          className="w-full flex items-center justify-between p-2 rounded hover:bg-white transition-colors cursor-pointer border border-transparent hover:border-slate-200"
        >
          <div className="flex items-center space-x-2 min-w-0 font-mono">
            <div className="w-5 h-5 rounded bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
              V
            </div>
            <div className="truncate text-xs text-slate-700 font-medium">
              {riderBike} · {riderWeight}kg
            </div>
          </div>
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </div>
    </aside>
  );
}

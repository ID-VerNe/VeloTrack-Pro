import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Copy, Check, RotateCcw, AlertCircle, Target, ArrowRight, Bike, CheckCircle2 } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import type { ChatMessage } from '../../types/rider';

interface Props {
  message: ChatMessage;
  isLoading: boolean;
  onRegenerate: () => void;
  onOpenProfile?: () => void;
}

export default function ChatMessageItem({ message, isLoading, onRegenerate, onOpenProfile }: Props) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // 1. Detect Goal Sync Action from tool_calls or comprehensive text heuristics
  const toolCallsStr = typeof message.tool_calls === 'string' 
    ? message.tool_calls 
    : JSON.stringify(message.tool_calls || []);

  const hasGoalToolCall = toolCallsStr.includes('set_training_goals');
  const hasProfileToolCall = toolCallsStr.includes('update_rider_profile') || toolCallsStr.includes('update_profile');

  const hasGoalTextHeuristic = 
    message.role === 'assistant' && 
    (message.content.includes('目标已生效') || 
     message.content.includes('新目标已生效') ||
     message.content.includes('目标已成功同步') || 
     message.content.includes('新目标参数已生效') || 
     message.content.includes('已在系统成功设定') ||
     message.content.includes('已为你自动同步') ||
     message.content.includes('新阶段目标') ||
     message.content.includes('已更新训练目标') ||
     message.content.includes('已自动写入系统生效'));

  const hasProfileTextHeuristic = 
    message.role === 'assistant' && 
    (message.content.includes('已为您更新齿比') || 
     message.content.includes('已成功更新档案') ||
     message.content.includes('已更新你的档案') ||
     message.content.includes('已记录并更新') ||
     message.content.includes('硬件配置已成功更新'));

  const isGoalAction = hasGoalToolCall || hasGoalTextHeuristic;
  const isProfileAction = hasProfileToolCall || hasProfileTextHeuristic;

  return (
    <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
      <div
        className={`flex items-start space-x-3 w-full ${
          message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
        }`}
      >
        {/* Role Avatar */}
        <div
          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold font-mono ${
            message.role === 'user'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-800 text-slate-100 shadow-xs border border-slate-700'
          }`}
        >
          {message.role === 'user' ? <User className="w-3.5 h-3.5" /> : 'VT'}
        </div>

        {/* Message Body */}
        <div className="flex-1 min-w-0 max-w-[92%] sm:max-w-[88%] space-y-2">
          {message.role === 'user' ? (
            <div className="bg-slate-900 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-xs sm:text-sm font-medium leading-relaxed shadow-xs inline-block">
              {message.content}
            </div>
          ) : message.isError ? (
            <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center space-x-2 text-rose-700 font-bold">
                <AlertCircle className="w-4 h-4" />
                <span>未能获取完整推演结果</span>
              </div>
              <p className="text-slate-600">{message.content}</p>
              <button
                onClick={onRegenerate}
                className="mt-2 px-3 py-1.5 bg-white hover:bg-slate-50 border border-rose-200 text-rose-700 rounded-lg font-bold text-xs shadow-xs cursor-pointer flex items-center space-x-1.5 active:scale-95"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重新推演</span>
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-sm p-4.5 sm:p-5 shadow-xs space-y-3.5">
              {/* Prominent Action Banner for Goal Sync */}
              {isGoalAction && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Target className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-emerald-950 flex items-center space-x-1.5 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">阶段训练目标与量化指标已写入生效</span>
                      </div>
                      <p className="text-[11px] text-emerald-700 font-medium mt-0.5 truncate">
                        已同步至系统目标看板，巡航配速与周程进度即时更新
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/goals"
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-2xs transition-all flex items-center space-x-1 shrink-0 cursor-pointer active:scale-95 text-xs"
                  >
                    <span>查看目标进度</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* Prominent Action Banner for Profile / Hardware Sync */}
              {isProfileAction && !isGoalAction && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Bike className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 flex items-center space-x-1.5 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                        <span className="truncate">战车硬件参数与传动规格已成功更新</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                        分立硬件与齿比参数已写入数据库，原配件记录已保留
                      </p>
                    </div>
                  </div>
                  {onOpenProfile && (
                    <button
                      type="button"
                      onClick={onOpenProfile}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg shadow-2xs transition-all flex items-center space-x-1 shrink-0 cursor-pointer active:scale-95 text-xs"
                    >
                      <span>查看档案</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Main Markdown Content */}
              <div className="markdown-body">
                <MarkdownRenderer content={message.content} />
              </div>

              {/* Footer Controls */}
              <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span className="text-[11px] font-medium text-slate-400 font-mono">
                  已代入战车传动比 · 遥测数据校验就绪
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopy}
                    className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer flex items-center space-x-1 text-[11px]"
                    title="复制推演内容"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">已复制</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>复制</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={onRegenerate}
                    disabled={isLoading}
                    className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer flex items-center space-x-1 text-[11px] disabled:opacity-50"
                    title="重新推演此方案"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>重新推演</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

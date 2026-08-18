import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Copy, Check, RotateCcw, AlertCircle, ArrowRight } from 'lucide-react';
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
          className={`w-6 h-6 rounded flex items-center justify-center shrink-0 text-xs font-mono border ${
            message.role === 'user'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-slate-50 text-slate-700 font-medium'
          }`}
        >
          {message.role === 'user' ? <User className="w-3 h-3" /> : 'VT'}
        </div>

        {/* Message Body */}
        <div className="flex-1 min-w-0 max-w-[92%] sm:max-w-[88%] space-y-2">
          {message.role === 'user' ? (
            <div className="bg-slate-900 text-white rounded px-4 py-2.5 text-xs font-normal leading-relaxed inline-block">
              {message.content}
            </div>
          ) : message.isError ? (
            <div className="bg-white border border-rose-200 rounded p-4 text-xs space-y-2 font-mono">
              <div className="flex items-center space-x-2 text-rose-700 font-medium">
                <AlertCircle className="w-4 h-4" />
                <span>未能获取完整推演结果</span>
              </div>
              <p className="text-slate-600 font-sans">{message.content}</p>
              <button
                onClick={onRegenerate}
                className="mt-2 px-3 py-1 bg-white hover:bg-slate-50 border border-rose-200 text-rose-700 rounded text-xs cursor-pointer flex items-center space-x-1.5 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重新推演</span>
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded p-5 space-y-4">
              {/* Prominent Action Banner for Goal Sync */}
              {isGoalAction && (
                <div className="bg-slate-50 border border-slate-200 rounded p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 text-xs">
                      阶段训练目标与量化指标已写入生效
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                      已同步至目标看板，周目标与巡航基准已更新
                    </p>
                  </div>
                  <Link
                    to="/goals"
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-mono transition-colors flex items-center space-x-1 shrink-0 cursor-pointer"
                  >
                    <span>查看目标进度</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* Prominent Action Banner for Profile / Hardware Sync */}
              {isProfileAction && !isGoalAction && (
                <div className="bg-slate-50 border border-slate-200 rounded p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 text-xs">
                      战车硬件参数与传动规格已成功更新
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                      车辆参数与齿比配置已更新
                    </p>
                  </div>
                  {onOpenProfile && (
                    <button
                      type="button"
                      onClick={onOpenProfile}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-mono transition-colors flex items-center space-x-1 shrink-0 cursor-pointer"
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
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>
                  已匹配当前车辆齿比与踏频基准
                </span>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleCopy}
                    className="hover:text-slate-900 transition-colors cursor-pointer flex items-center space-x-1"
                    title="复制推演内容"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3 text-slate-900" />
                        <span className="text-slate-900 font-medium">已复制</span>
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
                    className="hover:text-slate-900 transition-colors cursor-pointer flex items-center space-x-1 disabled:opacity-30"
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

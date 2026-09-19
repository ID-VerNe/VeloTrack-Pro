import React, { useState } from 'react';
import { User, Copy, Check, RotateCcw, AlertCircle } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import type { ChatMessage } from '../../types/rider';
import { detectChatAction } from '../../utils/chatActionDetector';
import ChatActionBanner from './ChatActionBanner';

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

  const { actionType } = detectChatAction(message);

  return (
    <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
      <div
        className={`flex items-start space-x-3 w-full ${
          message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
        }`}
      >
        {/* Role Avatar */}
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-mono border ${
            message.role === 'user'
              ? 'border-brand-500 bg-brand-500 text-white'
              : 'border-slate-200 bg-slate-50 text-slate-700 font-medium'
          }`}
        >
          {message.role === 'user' ? <User className="w-3 h-3" /> : 'VT'}
        </div>

        {/* Message Body */}
        <div className="flex-1 min-w-0 max-w-[92%] sm:max-w-[88%] space-y-2">
          {message.role === 'user' ? (
            <div className="bg-brand-500 text-white rounded-xl px-4 py-2.5 text-xs font-normal leading-relaxed inline-block shadow-2xs">
              {message.content}
            </div>
          ) : message.isError ? (
            <div className="bg-white border border-rose-200 rounded-xl p-4 text-xs space-y-2 font-mono">
              <div className="flex items-center space-x-2 text-rose-700 font-medium">
                <AlertCircle className="w-4 h-4" />
                <span>未能获取完整推演结果</span>
              </div>
              <p className="text-slate-600 font-sans">{message.content}</p>
              <button
                onClick={onRegenerate}
                className="mt-2 px-3 py-1 bg-white hover:bg-slate-50 border border-rose-200 text-rose-700 rounded-md text-xs cursor-pointer flex items-center space-x-1.5 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重新推演</span>
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/80 rounded-xl p-5 space-y-4">
              {/* Action Banner for Goal Sync or Profile Sync */}
              <ChatActionBanner actionType={actionType} onOpenProfile={onOpenProfile} />

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

import React, { useRef, useEffect } from 'react';
import { CornerDownLeft, Send } from 'lucide-react';

interface Props {
  input: string;
  isLoading: boolean;
  suggestedPrompts: string[];
  onInputChange: (value: string) => void;
  onSend: (text?: string) => void;
}

export default function ChatComposer({
  input,
  isLoading,
  suggestedPrompts,
  onInputChange,
  onSend,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isComposing, setIsComposing] = React.useState(false);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  };

  useEffect(() => {
    if (!input && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input]);

  return (
    <div className="p-4 sm:p-5 bg-white border-t border-slate-200/80 shrink-0 shadow-xs">
      <div className="max-w-3xl mx-auto space-y-2.5">
        {/* Quick Suggestion Chips */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 font-mono">
            专项推演:
          </span>
          {suggestedPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => onSend(p)}
              disabled={isLoading}
              className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 text-xs font-medium border border-slate-200 shadow-2xs shrink-0 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Textarea Composer */}
        <div className="relative bg-white rounded-2xl border border-slate-300 shadow-card focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 transition-all p-3">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleTextChange}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                if (isComposing || (e.nativeEvent as any).isComposing) {
                  return;
                }
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="输入训练诉求或齿比配速推演指令... (Enter 发送，Shift + Enter 换行)"
            className="w-full px-1 py-1 bg-transparent text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none resize-none max-h-[180px]"
            disabled={isLoading}
          />

          {/* Bottom Toolbar inside Composer */}
          <div className="flex items-center justify-between pt-2 px-1 border-t border-slate-100">
            <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
              <span>Enter 发送 · Shift+Enter 换行</span>
            </div>

            <button
              type="button"
              onClick={() => onSend()}
              disabled={!input.trim() || isLoading}
              className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed flex items-center space-x-1.5"
            >
              <Send className="w-3 h-3" />
              <span>推演执行</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// apps/web/src/components/common/SyncStatusBar.tsx
//
// 全局同步状态指示器：
// 1. 顶部微型同步状态点（就绪/同步中/离线/异常）
// 2. 弱提示横幅：“已同步 N 条最新骑行”，2.5 秒后平滑淡出
// 3. 点击一键手动触发与服务端增量对齐

import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle2, WifiOff, AlertCircle, Sparkles } from 'lucide-react';
import { syncEngine, type SyncStatus } from '../../services/syncEngine';

export default function SyncStatusBar() {
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());
  const [syncToast, setSyncToast] = useState<string | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const unsubscribe = syncEngine.subscribe((event) => {
      setStatus(event.status);

      if (event.type === 'sync_completed' && event.newCount && event.newCount > 0) {
        setSyncToast(`已同步 ${event.newCount} 条最新骑行`);
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          setSyncToast(null);
        }, 2800);
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const handleManualSync = (e: React.MouseEvent) => {
    e.preventDefault();
    if (status === 'syncing') return;
    syncEngine.pullSync({ force: true }).catch(() => {});
  };

  return (
    <div className="relative flex items-center">
      {/* 浮动微提示横幅 (自动淡出) */}
      {syncToast && (
        <div
          role="status"
          aria-live="polite"
          className="absolute right-0 top-10 z-50 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-xs font-medium rounded-full shadow-lg shadow-emerald-950/40 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none whitespace-nowrap"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* 状态小徽标 */}
      <button
        onClick={handleManualSync}
        title={
          status === 'syncing'
            ? '正在与云端对齐数据...'
            : status === 'offline'
            ? '当前处于离线模式（数据本地留存，点击重新尝试连网）'
            : status === 'error'
            ? '同步暂缓，点击重试'
            : '本地数据已同步（点击强制刷新）'
        }
        className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-mono transition-all duration-150 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 active:scale-95"
      >
        {status === 'syncing' ? (
          <>
            <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin" />
            <span className="text-cyan-400 hidden sm:inline">同步中</span>
          </>
        ) : status === 'offline' ? (
          <>
            <WifiOff className="w-3 h-3 text-slate-400" />
            <span className="text-slate-400 hidden sm:inline">离线</span>
          </>
        ) : status === 'error' ? (
          <>
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span className="text-amber-400 hidden sm:inline">重试</span>
          </>
        ) : (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-slate-300 hidden sm:inline">已对齐</span>
          </>
        )}
      </button>
    </div>
  );
}

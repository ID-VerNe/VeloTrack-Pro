// apps/web/src/components/common/SyncStatusBar.tsx
//
// 全局同步状态指示器：
// 1. 静默就绪哲学：正常时 3 秒自动收缩为精致微点，彻底消除无限 ping 视觉噪音
// 2. 悬停展开与主动交互：鼠标靠近或聚焦时平滑展开药丸，随时点击强制与云端对齐
// 3. 异常即时显形：正在同步/离线/同步暂缓时自动常驻展开，明确反馈
// 4. 浅色现代设计：采用白底毛玻璃与 Slate 质感，与主系统完美融合

import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw, WifiOff, AlertCircle, Sparkles } from 'lucide-react';
import { syncEngine, type SyncStatus } from '../../services/syncEngine';

export default function SyncStatusBar({
  placement = 'bottom-left',
}: {
  placement?: 'bottom-left' | 'top-right';
}) {
  const [status, setStatus] = useState<SyncStatus>(syncEngine.getStatus());
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  // 首次挂载或状态更新后临时展开 3 秒，之后平滑收缩
  const [isTemporarilyVisible, setIsTemporarilyVisible] = useState(true);
  const tempTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerTemporaryVisibility = (durationMs = 3000) => {
    setIsTemporarilyVisible(true);
    if (tempTimerRef.current) clearTimeout(tempTimerRef.current);
    tempTimerRef.current = setTimeout(() => {
      setIsTemporarilyVisible(false);
    }, durationMs);
  };

  useEffect(() => {
    // 页面加载初期展示 3 秒，让用户对当前连接状态有第一印象
    triggerTemporaryVisibility(3000);

    let toastTimer: NodeJS.Timeout | null = null;

    const unsubscribe = syncEngine.subscribe((event) => {
      setStatus(event.status);

      if (event.type === 'sync_completed') {
        // 增量同步完成时，亮起 3 秒
        triggerTemporaryVisibility(3000);
        if (event.newCount && event.newCount > 0) {
          setSyncToast(`已同步 ${event.newCount} 条最新骑行`);
          if (toastTimer) clearTimeout(toastTimer);
          toastTimer = setTimeout(() => {
            setSyncToast(null);
          }, 2800);
        }
      } else if (event.type === 'status_change' && (event.status === 'synced' || event.status === 'idle')) {
        triggerTemporaryVisibility(3000);
      }
    });

    return () => {
      if (tempTimerRef.current) clearTimeout(tempTimerRef.current);
      if (toastTimer) clearTimeout(toastTimer);
      unsubscribe();
    };
  }, []);

  const handleManualSync = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status === 'syncing') return;
    triggerTemporaryVisibility(4000);
    syncEngine.pullSync({ force: true }).catch(() => {});
  };

  // 展开判断：悬停中、临时可见窗口中、或非就绪异常状态（同步中/离线/错误）必须常驻展开
  const isExpanded =
    isHovered ||
    isTemporarilyVisible ||
    status === 'syncing' ||
    status === 'offline' ||
    status === 'error';

  const getAriaLabel = () => {
    switch (status) {
      case 'syncing':
        return '数据同步中，正在与云端对齐';
      case 'offline':
        return '当前处于离线模式，点击重新连接';
      case 'error':
        return '同步暂缓，点击重试';
      case 'synced':
      case 'idle':
      default:
        return '数据已同步，点击手动与云端对齐';
    }
  };

  const getTitle = () => {
    switch (status) {
      case 'syncing':
        return '正在与云端对齐数据...';
      case 'offline':
        return '当前处于离线模式（数据本地留存，点击重新尝试连网）';
      case 'error':
        return '同步暂缓，点击立即重试';
      case 'synced':
      case 'idle':
      default:
        return '本地数据已与云端同步（点击强制刷新）';
    }
  };

  return (
    <div
      className="relative flex items-center shrink-0"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 浮动微提示横幅 (增量数据到达时触发，2.8s 后平滑淡出) */}
      {syncToast && (
        <div
          role="status"
          aria-live="polite"
          className={`
            absolute z-50 flex items-center gap-1.5 px-3 py-1.5 bg-white/95 border border-emerald-500/30 text-emerald-800 text-xs font-sans font-medium rounded-full shadow-lg shadow-slate-900/5 backdrop-blur-md animate-in fade-in duration-200 pointer-events-none whitespace-nowrap
            ${placement === 'bottom-left' ? 'left-0 bottom-10 slide-in-from-bottom-2' : 'right-0 top-9 slide-in-from-top-2'}
          `}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>{syncToast}</span>
        </div>
      )}

      {/* 状态指示徽标：微点折叠态 <-> 展开药丸态 */}
      <button
        onClick={handleManualSync}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        aria-label={getAriaLabel()}
        title={getTitle()}
        className={`
          group relative flex items-center rounded-full text-xs font-sans font-medium transition-all duration-300 ease-out
          border shadow-2xs backdrop-blur-md cursor-pointer select-none active:scale-95
          focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1
          ${
            status === 'syncing'
              ? 'bg-cyan-50/90 text-cyan-700 border-cyan-200/90 hover:bg-cyan-100/90'
              : status === 'offline'
              ? 'bg-slate-100/90 text-slate-500 border-slate-300/90 hover:bg-slate-200/90'
              : status === 'error'
              ? 'bg-amber-50/90 text-amber-700 border-amber-200/90 hover:bg-amber-100/90'
              : 'bg-white/90 text-slate-600 hover:text-slate-900 border-slate-200/90 hover:bg-white hover:border-slate-300 shadow-2xs'
          }
          ${isExpanded ? 'px-2.5 py-1' : 'p-1.5'}
        `}
      >
        {/* 图标/状态指示点 */}
        {status === 'syncing' ? (
          <RefreshCw className="w-3.5 h-3.5 text-cyan-600 animate-spin motion-reduce:animate-none shrink-0" />
        ) : status === 'offline' ? (
          <WifiOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        ) : status === 'error' ? (
          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
        ) : (
          <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
            {/* 静态温润绿点，杜绝无限 ping 闪烁 */}
            <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500 ring-2 ring-emerald-50"></span>
          </span>
        )}

        {/* 状态文字：平滑收缩展开 */}
        <span
          className={`
            inline-block overflow-hidden whitespace-nowrap transition-all duration-300 ease-out text-[11px]
            ${isExpanded ? 'max-w-[100px] opacity-100 ml-1.5' : 'max-w-0 opacity-0 ml-0'}
          `}
        >
          {status === 'syncing'
            ? '同步中'
            : status === 'offline'
            ? '离线模式'
            : status === 'error'
            ? '同步暂缓'
            : '已同步'}
        </span>
      </button>
    </div>
  );
}

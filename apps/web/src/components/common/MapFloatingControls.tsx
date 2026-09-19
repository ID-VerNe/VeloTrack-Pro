import React from 'react';
import { Plus, Minus, Maximize2 } from 'lucide-react';

export interface MapFloatingControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitBounds: () => void;
  fitLabel?: string;
  className?: string;
}

export default function MapFloatingControls({
  onZoomIn,
  onZoomOut,
  onFitBounds,
  fitLabel = '适应全部轨迹',
  className = 'absolute right-4 bottom-6 z-20',
}: MapFloatingControlsProps) {
  return (
    <div
      className={`${className} flex flex-col bg-white/90 backdrop-blur-md rounded-xl border border-slate-200/80 shadow-md divide-y divide-slate-200/60 overflow-hidden pointer-events-auto`}
    >
      <button
        onClick={onFitBounds}
        className="p-2.5 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors active:scale-95 cursor-pointer flex items-center justify-center"
        aria-label={fitLabel}
        title={fitLabel}
      >
        <Maximize2 className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        onClick={onZoomIn}
        className="p-2.5 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors active:scale-95 cursor-pointer flex items-center justify-center"
        aria-label="放大"
        title="放大"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
      </button>
      <button
        onClick={onZoomOut}
        className="p-2.5 text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors active:scale-95 cursor-pointer flex items-center justify-center"
        aria-label="缩小"
        title="缩小"
      >
        <Minus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}

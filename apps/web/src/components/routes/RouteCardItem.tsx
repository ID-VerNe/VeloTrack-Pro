import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { RouteItem } from '../../data/curatedRoutes';

interface Props {
  route: RouteItem;
  isSelected: boolean;
  onSelect: (route: RouteItem) => void;
}

export default function RouteCardItem({ route, isSelected, onSelect }: Props) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={`选择路线 ${route.name}，${route.distanceKm} 公里`}
      onClick={() => onSelect(route)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(route);
        }
      }}
      className={`w-full text-left p-4 rounded border transition-colors cursor-pointer space-y-2 ${
        isSelected
          ? 'bg-slate-50 border-slate-900 border-l-2'
          : 'bg-white border-slate-200/80 hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200 text-slate-600 bg-white">
          {route.city} · {route.difficulty}
        </span>
        <span className="text-xs font-semibold tabular-nums font-mono text-slate-900">
          {route.distanceKm} km
        </span>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-slate-900">{route.name}</h3>
        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
          {route.description}
        </p>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] font-mono text-slate-400">
        <span>爬升 {route.ascentM}m</span>
        <span className="font-medium text-slate-900 flex items-center group">
          查看详情 <ChevronRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
        </span>
      </div>
    </button>
  );
}

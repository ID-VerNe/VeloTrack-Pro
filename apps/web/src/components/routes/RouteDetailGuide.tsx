import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import RouteMapPreview from './RouteMapPreview';
import type { RouteItem } from '../../data/curatedRoutes';

interface Props {
  route: RouteItem;
  onAskCoach: () => void;
}

export default function RouteDetailGuide({ route, onAskCoach }: Props) {
  return (
    <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-6 [scrollbar-width:none]">
      {/* 1. 交互式地图预览 */}
      <RouteMapPreview
        coordinates={route.coordinates}
        routeName={route.name}
      />

      {/* 2. 标题、标签与 AI 推演跳转 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2 font-mono">
            <span className="px-2 py-0.5 rounded text-[10px] bg-brand-500 text-white font-medium shadow-2xs">
              {route.city}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] bg-slate-50 text-slate-700 font-medium border border-slate-200">
              {route.difficulty}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">{route.name}</h2>
          <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
            {route.description}
          </p>
        </div>

        {/* 齿比与配速推演按钮 */}
        <button
          onClick={onAskCoach}
          className="px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded text-xs font-mono transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0 self-start sm:self-auto shadow-2xs"
          title="以此路线为目标推演齿比与踏频"
        >
          <span>推演此路线齿比与配速</span>
          <ArrowUpRight className="w-3.5 h-3.5 text-brand-200" />
        </button>
      </div>

      {/* 3. 核心指标看板 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded border border-slate-200/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">单圈里程</div>
          <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
            {route.distanceKm} <span className="text-xs font-normal text-slate-400 font-sans">km</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded border border-slate-200/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">累计爬升</div>
          <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
            {route.ascentM} <span className="text-xs font-normal text-slate-400 font-sans">m</span>
          </div>
        </div>
        <div className="bg-white p-5 rounded border border-slate-200/80">
          <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">推荐适用车型</div>
          <div className="text-xs font-medium text-slate-900 mt-2 truncate">
            {route.suitableBike}
          </div>
        </div>
      </div>

      {/* 4. 路线特征高光 */}
      <div className="bg-white rounded border border-slate-200/80 p-5 space-y-3">
        <h3 className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">路线特征</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {route.highlights.map((h, i) => (
            <div key={i} className="bg-slate-50 p-3 rounded border border-slate-200/80 text-xs font-normal text-slate-700 flex items-center space-x-2">
              <span className="w-1 h-1 rounded-full bg-brand-500 shrink-0" />
              <span>{h}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. 战术齿比与膝盖保护提示 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 齿比与踏频建议 */}
        <div className="bg-white rounded p-5 border border-slate-200/80 space-y-2">
          <div className="text-xs font-semibold text-slate-900">
            <span>齿比与踏频建议</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-mono">
            {route.recommendedGear}
          </p>
        </div>

        {/* 膝关节保护提示 */}
        <div className="bg-white rounded p-5 border border-slate-200/80 space-y-2">
          <div className="text-xs font-semibold text-slate-900">
            <span>膝关节保护提示</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            {route.kneeSafetyAdvice}
          </p>
        </div>
      </div>
    </div>
  );
}

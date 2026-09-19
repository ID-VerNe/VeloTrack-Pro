import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight,
  ArrowUpRight
} from 'lucide-react';
import RouteMapPreview from '../components/routes/RouteMapPreview';
import { RouteItem, CURATED_ROUTES } from '../data/curatedRoutes';

export default function RoutesExplorer() {
  const navigate = useNavigate();
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [selectedRoute, setSelectedRoute] = useState<RouteItem>(CURATED_ROUTES[0]);

  const filteredRoutes = CURATED_ROUTES.filter((r) => {
    if (selectedCity === 'all') return true;
    return r.city === selectedCity;
  });

  const handleAskCoachAboutRoute = () => {
    const prompt = `我想去骑行【${selectedRoute.city}·${selectedRoute.name}】（距离 ${selectedRoute.distanceKm}km，爬升 ${selectedRoute.ascentM}m），请结合我的大行 P8 齿比配置与膝盖防护需求，给出战术配速节奏与补给建议。`;
    navigate('/ai-coach?prompt=' + encodeURIComponent(prompt));
  };

  return (
    <div className="h-full w-full bg-[#F8FAFC] flex flex-col text-slate-900 overflow-hidden select-none">
      <main className="flex-1 h-full flex flex-col bg-white overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-16 px-4 md:px-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-tight">城市精选路线</h1>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">大湾区经典骑行路线 · 包含推荐齿比与膝盖保护提示</p>
          </div>

          <div className="flex items-center space-x-1 border border-slate-200 p-0.5 rounded font-mono text-xs">
            {['all', '深圳', '广州'].map((c) => (
              <button
                key={c}
                onClick={() => setSelectedCity(c)}
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                  selectedCity === c ? 'bg-brand-500 text-white font-medium shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {c === 'all' ? '全部城市' : c}
              </button>
            ))}
          </div>
        </header>

        {/* 2-Column Split Workspace */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left Route List (40%) */}
          <div className="w-full lg:w-[420px] h-[40dvh] lg:h-full border-b lg:border-b-0 lg:border-r border-slate-100 p-4 md:p-6 overflow-y-auto space-y-3 shrink-0 [scrollbar-width:none]">
            <div className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest mb-3">
              路线列表 ({filteredRoutes.length})
            </div>

            {filteredRoutes.map((route) => {
              const isSelected = selectedRoute.id === route.id;
              return (
                <button
                  key={route.id}
                  type="button"

                  aria-pressed={isSelected}
                  aria-label={`选择路线 ${route.name}，${route.distanceKm} 公里`}
                  onClick={() => setSelectedRoute(route)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedRoute(route);
                    }
                  }}
                  className={`p-4 rounded border transition-colors cursor-pointer space-y-2 ${
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
                    <span>
                      爬升 {route.ascentM}m
                    </span>
                    <span className="font-medium text-slate-900 flex items-center group">
                      查看详情 <ChevronRight className="w-3 h-3 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Route Detailed Guide (60%) */}
          <div className="flex-1 p-4 md:p-4 md:p-8 overflow-y-auto space-y-6 [scrollbar-width:none]">
            {/* 1. Interactive Route Map Preview */}
            <RouteMapPreview
              coordinates={selectedRoute.coordinates}
              routeName={selectedRoute.name}
            />

            {/* 2. Route Title & Badges */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 font-mono">
                  <span className="px-2 py-0.5 rounded text-[10px] bg-brand-500 text-white font-medium shadow-2xs">
                    {selectedRoute.city}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-50 text-slate-700 font-medium border border-slate-200">
                    {selectedRoute.difficulty}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-slate-900 tracking-tight">{selectedRoute.name}</h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
                  {selectedRoute.description}
                </p>
              </div>

              {/* Telemetry Simulation Button */}
              <button
                onClick={handleAskCoachAboutRoute}
                className="px-3.5 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded text-xs font-mono transition-colors cursor-pointer flex items-center space-x-1.5 shrink-0 self-start sm:self-auto shadow-2xs"
                title="以此路线为目标推演齿比与踏频"
              >
                <span>推演此路线齿比与配速</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-brand-200" />
              </button>
            </div>

            {/* 3. Quick Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded border border-slate-200/80">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">单圈里程</div>
                <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
                  {selectedRoute.distanceKm} <span className="text-xs font-normal text-slate-400 font-sans">km</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded border border-slate-200/80">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">累计爬升</div>
                <div className="text-2xl font-semibold font-mono text-slate-900 mt-1 tabular-nums">
                  {selectedRoute.ascentM} <span className="text-xs font-normal text-slate-400 font-sans">m</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded border border-slate-200/80">
                <div className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">推荐适用车型</div>
                <div className="text-xs font-medium text-slate-900 mt-2 truncate">
                  {selectedRoute.suitableBike}
                </div>
              </div>
            </div>

            {/* 4. Highlights */}
            <div className="bg-white rounded border border-slate-200/80 p-5 space-y-3">
              <h3 className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">路线特征</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {selectedRoute.highlights.map((h, i) => (
                  <div key={i} className="bg-slate-50 p-3 rounded border border-slate-200/80 text-xs font-normal text-slate-700 flex items-center space-x-2">
                    <span className="w-1 h-1 rounded-full bg-brand-500 shrink-0" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Tactical Gear & Knee Safety Guidance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Gear Ratio Strategy */}
              <div className="bg-white rounded p-5 border border-slate-200/80 space-y-2">
                <div className="text-xs font-semibold text-slate-900">
                  <span>齿比与踏频建议</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-mono">
                  {selectedRoute.recommendedGear}
                </p>
              </div>

              {/* Knee Safety Advice */}
              <div className="bg-white rounded p-5 border border-slate-200/80 space-y-2">
                <div className="text-xs font-semibold text-slate-900">
                  <span>膝关节保护提示</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {selectedRoute.kneeSafetyAdvice}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

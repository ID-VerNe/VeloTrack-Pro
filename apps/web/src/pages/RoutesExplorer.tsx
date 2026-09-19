import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RouteCardItem from '../components/routes/RouteCardItem';
import RouteDetailGuide from '../components/routes/RouteDetailGuide';
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

            {filteredRoutes.map((route) => (
              <RouteCardItem
                key={route.id}
                route={route}
                isSelected={selectedRoute.id === route.id}
                onSelect={setSelectedRoute}
              />
            ))}
          </div>

          {/* Right Route Detailed Guide (60%) */}
          <RouteDetailGuide
            route={selectedRoute}
            onAskCoach={handleAskCoachAboutRoute}
          />
        </div>
      </main>
    </div>
  );
}

import React, { useEffect, useState, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';

import Sidebar from '../components/Sidebar';
import TotalStatsCard from '../components/TotalStatsCard';
import ConsistencyHeatmap from '../components/ConsistencyHeatmap';
import RideCard from '../components/RideCard';
import { extractCitiesFromRides, detectCityForRide } from '../utils/geoUtils';

import DashboardMap from '../components/dashboard/DashboardMap';
import DashboardControls from '../components/dashboard/DashboardControls';
import { useApi } from '../hooks/useApi';
import { useMapStyle } from '../contexts/MapStyleContext';

export default function Dashboard() {
  // 统一取数：loading/error 由 useApi 托管，避免 API 故障被误呈现为"没有数据"
  const { data: fetchedRides, isLoading, error: loadError } = useApi<any[]>(
    '/api/rides',
    (json) => json.rides || []
  );
  const rides = fetchedRides ?? [];
  const [riderName, setRiderName] = useState<string>('车手');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [hoveredRideId, setHoveredRideId] = useState<string | null>(null);
  // 底图偏好全局共享：与骑行详情页联动，localStorage 持久化
  const { mapStyle: currentMapStyle, setMapStyle: setCurrentMapStyle } = useMapStyle();

  // Time-aware greeting
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = '你好';
    if (hour < 6) timeGreeting = '夜深了';
    else if (hour < 11) timeGreeting = '早上好';
    else if (hour < 13) timeGreeting = '中午好';
    else if (hour < 18) timeGreeting = '下午好';
    else timeGreeting = '晚上好';
    return `${timeGreeting}，${riderName}`;
  }, [riderName]);

  useEffect(() => {
    // 骑行列表由 useApi 统一拉取，此处仅补齐骑手昵称
    fetch('/api/ai/rider/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile?.name) setRiderName(data.profile.name);
      })
      .catch(() => {});
  }, []);

  const availableCities = useMemo(() => extractCitiesFromRides(rides), [rides]);

  const filteredRides = useMemo(() => {
    return rides.filter((r) => {
      const matchCity = selectedCity === 'all' || detectCityForRide(r) === selectedCity;
      const matchSearch =
        !searchTerm.trim() ||
        (r.title && r.title.toLowerCase().includes(searchTerm.toLowerCase().trim()));
      return matchCity && matchSearch;
    });
  }, [rides, selectedCity, searchTerm]);

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] font-sans flex text-slate-900 overflow-hidden select-none">
      {/* 1. Left Compact Navigation Sidebar */}
      <Sidebar />

      {/* 2. Center Geospatial Map Canvas */}
      <main className="flex-1 h-full relative overflow-hidden bg-slate-100 min-w-0">
        <DashboardControls
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          availableCities={availableCities}
          selectedCity={selectedCity}
          onCitySelect={setSelectedCity}
          currentMapStyle={currentMapStyle}
          onMapStyleChange={setCurrentMapStyle}
        />

        <DashboardMap
          rides={filteredRides}
          selectedCity={selectedCity}
          hoveredRideId={hoveredRideId}
          currentMapStyle={currentMapStyle}
        />
      </main>

      {/* 3. Right Analytics & Feeds Bento Panel */}
      <aside className="w-[460px] xl:w-[480px] h-full bg-white flex flex-col z-10 shrink-0 border-l border-slate-200/80">
        {/* Top User Greeting Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-semibold text-slate-900 tracking-tight leading-tight">
              {greetingText}
            </h1>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              已记录 {rides.length} 次骑行 · 目标踏频 85-95 rpm
            </p>
          </div>

          <div className="w-7 h-7 rounded border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-700 text-xs font-medium font-mono">
            {riderName.slice(0, 1) || 'V'}
          </div>
        </div>

        {/* Scrollable Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 [scrollbar-width:none]">
          {/* Global Aggregation Metric Card */}
          <TotalStatsCard rides={rides} />

          {/* 52-Week Activity Consistency Matrix */}
          <ConsistencyHeatmap rides={rides} />

          {/* Filtered Activity Cards Feed */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                {selectedCity === 'all' ? '全部骑行记录' : `${selectedCity} 骑行记录`} ({filteredRides.length})
              </h2>
            </div>

            <div className="space-y-3">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400 text-xs font-mono" role="status">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-slate-600" />
                  正在加载骑行遥测数据...
                </div>
              ) : loadError ? (
                <div className="p-6 text-center bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono space-y-2" role="alert">
                  <p className="text-slate-700">{loadError}</p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-3.5 py-1.5 bg-slate-900 text-white rounded text-xs font-mono font-medium hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    重新加载
                  </button>
                </div>
              ) : (
                <>
                  {filteredRides.map((ride) => (
                    <div
                      key={ride.id}
                      onMouseEnter={() => setHoveredRideId(ride.id)}
                      onMouseLeave={() => setHoveredRideId(null)}
                    >
                      <RideCard ride={ride} />
                    </div>
                  ))}

                  {filteredRides.length === 0 && (
                    <div className="p-8 text-center bg-slate-50/50 rounded-lg border border-slate-200 text-slate-400 text-xs font-mono">
                      没有匹配的骑行记录
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

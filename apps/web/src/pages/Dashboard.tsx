import React, { useEffect, useState, useMemo } from 'react';
import { Bike } from 'lucide-react';

import Sidebar from '../components/Sidebar';
import TotalStatsCard from '../components/TotalStatsCard';
import ConsistencyHeatmap from '../components/ConsistencyHeatmap';
import RideCard from '../components/RideCard';
import { extractCitiesFromRides, detectCityForRide } from '../utils/geoUtils';
import type { MapStyleKey } from '../utils/mapStyles';

import DashboardMap from '../components/dashboard/DashboardMap';
import DashboardControls from '../components/dashboard/DashboardControls';

export default function Dashboard() {
  const [rides, setRides] = useState<any[]>([]);
  const [riderName, setRiderName] = useState<string>('车手');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [hoveredRideId, setHoveredRideId] = useState<string | null>(null);
  const [currentMapStyle, setCurrentMapStyle] = useState<MapStyleKey>('light');

  // Time-aware greeting
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    let timeGreeting = '你好';
    if (hour < 6) timeGreeting = '夜深了';
    else if (hour < 11) timeGreeting = '早上好';
    else if (hour < 13) timeGreeting = '中午好';
    else if (hour < 18) timeGreeting = '下午好';
    else timeGreeting = '晚上好';
    return `${timeGreeting}，${riderName}！`;
  }, [riderName]);

  useEffect(() => {
    fetch('/api/rides')
      .then((res) => res.json())
      .then((data) => setRides(data.rides || []))
      .catch(console.error);

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
        r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        detectCityForRide(r)?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCity && matchSearch;
    });
  }, [rides, selectedCity, searchTerm]);

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] font-sans flex text-slate-900 overflow-hidden select-none">
      {/* 1. Global Left Navigation */}
      <Sidebar />

      {/* 2. Middle Interactive Map Viewport */}
      <main className="flex-1 h-full relative bg-slate-100 overflow-hidden border-r border-slate-200">
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
      <aside className="w-[420px] xl:w-[460px] h-full bg-white flex flex-col z-10 shadow-2xl shrink-0 border-l border-slate-100">
        {/* Top User Greeting Header */}
        <div className="px-6 py-5 border-b border-slate-100/80 bg-white flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
              {greetingText}
            </h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              已聚合 {rides.length} 条实战遥测轨迹 · 保持 85+ rpm 高踏频
            </p>
          </div>

          <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-xs font-bold font-mono shadow-xs">
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
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {selectedCity === 'all' ? '全部骑行动态' : `${selectedCity} 骑行动态`} ({filteredRides.length})
              </h2>
            </div>

            <div className="space-y-3">
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
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                  没有匹配的骑行记录
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

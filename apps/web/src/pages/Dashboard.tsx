import React, { useEffect, useState, useMemo } from 'react';
import { Bike } from 'lucide-react';

import Sidebar from '../components/Sidebar';
import TotalStatsCard from '../components/TotalStatsCard';
import ConsistencyHeatmap from '../components/ConsistencyHeatmap';
import RideCard from '../components/RideCard';
import { extractCitiesFromRides, detectCityForRide } from '../utils/geoUtils';

import DashboardMap from '../components/dashboard/DashboardMap';
import DashboardControls from '../components/dashboard/DashboardControls';

export default function Dashboard() {
  const [rides, setRides] = useState<any[]>([]);
  const [riderName, setRiderName] = useState<string>('车手');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  const [hoveredRideId, setHoveredRideId] = useState<string | null>(null);
  const [currentMapStyle, setCurrentMapStyle] = useState<'light' | 'satellite'>('light');

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
      const matchSearch =
        !searchTerm.trim() || (r.title || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchCity = selectedCity === 'all' || detectCityForRide(r) === selectedCity;
      return matchSearch && matchCity;
    });
  }, [rides, searchTerm, selectedCity]);

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] font-sans flex text-slate-900 overflow-hidden select-none">
      {/* Full-height Left Sidebar */}
      <Sidebar />

      {/* Main Workspace */}
      <main className="flex-1 h-screen p-5 lg:p-6 flex flex-col overflow-hidden min-w-0">
        {/* Header Greeting */}
        <header className="mb-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-slate-900">
              {greetingText}
            </h1>
            <p className="text-slate-400 text-xs font-medium mt-0.5">全域遥测数据看板与轨迹档案</p>
          </div>
        </header>

        {/* 2-Column Balanced Height-locked Layout */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-5 items-stretch overflow-hidden">
          {/* Left Column: Fluid Map with Floating Controls */}
          <div className="flex-1 h-full min-h-0 rounded-3xl overflow-hidden relative shadow-sm border border-slate-200/80 bg-slate-50">
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
          </div>

          {/* Right Column: Statistics & Activities Panel */}
          <div className="w-full lg:w-[460px] flex flex-col gap-4 h-full min-h-0 shrink-0 overflow-hidden">
            {/* Top Stat Cards Grid */}
            <div className="shrink-0">
              <TotalStatsCard rides={rides} />
            </div>

            {/* Consistency Annual Heatmap */}
            <div className="shrink-0">
              <ConsistencyHeatmap rides={rides} />
            </div>

            {/* Recent Activities List */}
            <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-bold text-slate-900">
                    {selectedCity === 'all' ? '全部城市动态' : `${selectedCity} 骑行记录`}
                  </h3>
                  <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-full font-mono">
                    {filteredRides.length} 次
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">悬停轨迹可高亮</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1 [scrollbar-width:none]">
                {filteredRides.length > 0 ? (
                  filteredRides.map((ride) => (
                    <RideCard
                      key={ride.id}
                      ride={ride}
                      isHovered={hoveredRideId === ride.id}
                      onMouseEnter={() => setHoveredRideId(ride.id)}
                      onMouseLeave={() => setHoveredRideId(null)}
                    />
                  ))
                ) : (
                  <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <Bike className="w-5 h-5 text-slate-300 mb-2" />
                    <span>未找到匹配的骑行记录</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

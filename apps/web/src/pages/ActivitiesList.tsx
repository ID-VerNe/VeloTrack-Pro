import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Layers, 
  Search, 
  ArrowUpDown,
  LayoutGrid, 
  List, 
  RefreshCw,
  Bike,
  RotateCcw,
  ChevronRight
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import RideCard from '../components/RideCard';
import { detectCityForRide } from '../utils/geoUtils';
import { formatDuration, formatRideDate } from '../utils/cyclingCalculations';

export default function ActivitiesList() {
  const [rides, setRides] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [distanceFilter, setDistanceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'dist_desc' | 'speed_desc' | 'ascent_desc'>('date_desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    setIsLoading(true);
    fetch('/api/rides')
      .then((res) => res.json())
      .then((data) => {
        if (data.rides) setRides(data.rides);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const isFiltered = searchQuery.trim() !== '' || cityFilter !== 'all' || distanceFilter !== 'all' || sortBy !== 'date_desc';

  const handleResetFilters = () => {
    setSearchQuery('');
    setCityFilter('all');
    setDistanceFilter('all');
    setSortBy('date_desc');
  };

  const filteredRides = useMemo(() => {
    return rides
      .filter((r) => {
        const titleMatch = (r.title || '').toLowerCase().includes(searchQuery.toLowerCase());
        const city = detectCityForRide(r);
        const cityMatch = cityFilter === 'all' || city === cityFilter;

        const distKm = (r.distance_meters || 0) / 1000;
        let distMatch = true;
        if (distanceFilter === 'short') distMatch = distKm < 15;
        else if (distanceFilter === 'medium') distMatch = distKm >= 15 && distKm <= 30;
        else if (distanceFilter === 'long') distMatch = distKm > 30;

        return titleMatch && cityMatch && distMatch;
      })
      .sort((a, b) => {
        if (sortBy === 'date_desc') return (b.start_time || 0) - (a.start_time || 0);
        if (sortBy === 'dist_desc') return (b.distance_meters || 0) - (a.distance_meters || 0);
        if (sortBy === 'speed_desc') return (b.avg_speed_kmh || 0) - (a.avg_speed_kmh || 0);
        if (sortBy === 'ascent_desc') return (b.total_ascent_meters || 0) - (a.total_ascent_meters || 0);
        return 0;
      });
  }, [rides, searchQuery, cityFilter, distanceFilter, sortBy]);

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] font-sans flex text-slate-900 overflow-hidden select-none">
      <Sidebar />

      <main className="flex-1 h-full flex flex-col bg-white overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-16 px-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/90 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight">骑行活动档案库</h1>
              <p className="text-xs text-slate-400 font-medium">共记录 {rides.length} 次骑行活动 · 已筛选 {filteredRides.length} 次</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center space-x-1 cursor-pointer"
                title="重置所有筛选条件"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重置筛选</span>
              </button>
            )}

            <div className="bg-slate-100 p-1 rounded-xl flex space-x-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
                title="网格卡片视图"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
                title="紧凑表格视图"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Filters and Search Bar */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/70 space-y-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="flex-1 min-w-[240px] relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索骑行活动名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
              />
            </div>

            {/* City Filter */}
            <div className="flex items-center space-x-1.5 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 px-1">城市:</span>
              {['all', '深圳', '广州'].map((c) => (
                <button
                  key={c}
                  onClick={() => setCityFilter(c)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    cityFilter === c ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {c === 'all' ? '全部' : c}
                </button>
              ))}
            </div>

            {/* Distance Filter */}
            <div className="flex items-center space-x-1.5 bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 px-1">里程:</span>
              {[
                { id: 'all', label: '全部' },
                { id: 'short', label: '<15km' },
                { id: 'medium', label: '15-30km' },
                { id: 'long', label: '>30km' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDistanceFilter(d.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    distanceFilter === d.id ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="date_desc">最新日期优先</option>
                <option value="dist_desc">里程最长优先</option>
                <option value="speed_desc">时速最快优先</option>
                <option value="ascent_desc">爬升最高优先</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Content Grid / List */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 [scrollbar-width:none]">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-slate-400 text-xs font-medium">
              <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
              正在加载活动列表...
            </div>
          ) : filteredRides.length === 0 ? (
            <div className="text-center py-24 text-slate-400 text-xs font-medium space-y-3">
              <Bike className="w-8 h-8 mx-auto text-slate-300" />
              <p>未找到符合条件的骑行活动</p>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-slate-800 transition-all cursor-pointer active:scale-95"
                >
                  清空筛选条件
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredRides.map((ride) => (
                <RideCard key={ride.id} ride={ride} />
              ))}
            </div>
          ) : (
            /* High-density Structured Table View */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
              <div className="divide-y divide-slate-100">
                {filteredRides.map((ride) => {
                  const distKm = ((ride.distance_meters || 0) / 1000).toFixed(1);
                  const duration = formatDuration(ride.moving_time_seconds || ride.elapsed_time_seconds || 0);
                  const city = detectCityForRide(ride);
                  const dateStr = formatRideDate(ride.start_time);

                  return (
                    <Link
                      key={ride.id}
                      to={`/ride/${ride.id}`}
                      state={{ from: '/rides' }}
                      className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-all group"
                    >
                      <div className="flex items-center space-x-4 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                          <Bike className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                              {ride.title}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold shrink-0">
                              {city}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {dateStr}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-6 text-xs text-slate-700 tabular-nums">
                        <div>
                          <span className="text-slate-400 font-normal">距离: </span>
                          <span className="font-bold text-slate-900">{distKm} km</span>
                        </div>
                        <div className="hidden sm:block">
                          <span className="text-slate-400 font-normal">均速: </span>
                          <span className="font-bold text-slate-900">{ride.avg_speed_kmh || 0} km/h</span>
                        </div>
                        <div className="hidden md:block">
                          <span className="text-slate-400 font-normal">爬升: </span>
                          <span className="font-bold text-slate-900">{ride.total_ascent_meters || 0} m</span>
                        </div>
                        <div className="text-slate-400 font-mono text-[11px] min-w-[60px] text-right">
                          {duration}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

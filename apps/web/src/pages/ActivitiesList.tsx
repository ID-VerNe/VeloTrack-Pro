import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  LayoutGrid, 
  List, 
  RefreshCw,
  RotateCcw,
  ArrowUpDown,
  ChevronRight,
  Trash2
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import RideCard from '../components/RideCard';
import { detectCityForRide, extractCitiesFromRides } from '../utils/geoUtils';
import { formatDuration, formatRideDate } from '../utils/cyclingCalculations';
import { useApi } from '../hooks/useApi';

export default function ActivitiesList() {
  // 统一取数：loading/error 由 useApi 托管，错误不再被静默吞掉
  const { data: fetchedRides, isLoading, error } = useApi<any[]>('/api/rides', (json) => json.rides || []);
  const [localRides, setLocalRides] = useState<any[] | null>(null);

  React.useEffect(() => {
    if (fetchedRides) {
      setLocalRides(fetchedRides);
    }
  }, [fetchedRides]);

  const rides = localRides ?? fetchedRides ?? [];
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [distanceFilter, setDistanceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date_desc' | 'dist_desc' | 'speed_desc' | 'ascent_desc'>('date_desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const availableCities = useMemo(() => extractCitiesFromRides(rides), [rides]);

  const isFiltered = searchQuery.trim() !== '' || cityFilter !== 'all' || distanceFilter !== 'all' || sortBy !== 'date_desc';

  const handleResetFilters = () => {
    setSearchQuery('');
    setCityFilter('all');
    setDistanceFilter('all');
    setSortBy('date_desc');
  };

  const handleDeleteRide = async (e: React.MouseEvent, rideId: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`确定要删除骑行记录「${title}」吗？此操作无法撤销。`)) {
      return;
    }
    setDeletingId(rideId);
    try {
      const res = await fetch(`/api/rides/${rideId}`, { method: 'DELETE' });
      if (res.ok) {
        setLocalRides((prev) => (prev ? prev.filter((r) => r.id !== rideId) : []));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || '删除失败，请重试');
      }
    } catch (err: any) {
      alert(err.message || '网络错误，删除失败');
    } finally {
      setDeletingId(null);
    }
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
        <header className="h-16 px-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-tight">骑行档案</h1>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">共记录 {rides.length} 次骑行 · 已筛选 {filteredRides.length} 次</p>
          </div>

          <div className="flex items-center space-x-3 font-mono">
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 rounded text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center space-x-1 cursor-pointer"
                title="重置所有筛选条件"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重置筛选</span>
              </button>
            )}

            <div className="border border-slate-200 p-0.5 rounded flex space-x-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="网格卡片视图"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-700'
                }`}
                title="紧凑表格视图"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Filters and Search Bar */}
        <div className="p-6 border-b border-slate-100 bg-white space-y-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="flex-1 min-w-[240px] relative font-mono">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="搜索骑行名称..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white rounded border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 shadow-2xs transition-colors"
              />
            </div>

            {/* Dynamic City Filter */}
            <div className="flex items-center space-x-1 bg-white px-1.5 py-1 rounded border border-slate-200 font-mono shadow-2xs">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 px-1">
                城市:
              </span>
              {availableCities.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCityFilter(c.id)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    cityFilter === c.id ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>{c.name}</span>
                  {c.id !== 'all' && (
                    <span className="text-[10px] ml-1 opacity-70">({c.count})</span>
                  )}
                </button>
              ))}
            </div>

            {/* Distance Filter */}
            <div className="flex items-center space-x-1 bg-white px-1.5 py-1 rounded border border-slate-200 font-mono shadow-2xs">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 px-1">里程:</span>
              {[
                { id: 'all', label: '全部' },
                { id: 'short', label: '<15km' },
                { id: 'medium', label: '15-30km' },
                { id: 'long', label: '>30km' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDistanceFilter(d.id)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    distanceFilter === d.id ? 'bg-slate-900 text-white font-medium' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
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
            <div className="h-64 flex items-center justify-center text-slate-500 text-xs font-medium" role="status">
              <RefreshCw className="w-5 h-5 animate-spin mr-2 text-sky-600" />
              正在加载骑行列表...
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center bg-rose-50/60 rounded-2xl border border-rose-100 text-xs font-medium space-y-3" role="alert">
              <p className="text-rose-700">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-slate-800 transition-all cursor-pointer active:scale-95"
              >
                重新加载
              </button>
            </div>
          ) : filteredRides.length === 0 ? (
            <div className="text-center py-24 text-slate-400 text-xs font-mono space-y-3">
              <p>未找到符合条件的骑行</p>
              {isFiltered && (
                <button
                  onClick={handleResetFilters}
                  className="px-3.5 py-1.5 bg-slate-900 text-white rounded text-xs transition-colors cursor-pointer"
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
            /* High-density Structured Table View with aligned Column Headers */
            <div className="bg-white rounded-lg border border-slate-200/80 overflow-hidden">
              {/* Header row */}
              <div className="px-5 py-2.5 bg-slate-50/50 border-b border-slate-200/80 flex items-center justify-between text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">骑行名称与日期</div>
                </div>
                <div className="flex items-center space-x-6 text-right tabular-nums">
                  <div className="w-20">距离</div>
                  <div className="w-20 hidden sm:block">停表均速</div>
                  <div className="w-20 hidden md:block">累计爬升</div>
                  <div className="w-20">运动耗时</div>
                  <div className="w-6 text-center">进入</div>
                </div>
              </div>

              {/* Data rows */}
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
                      className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors group"
                    >
                      <div className="min-w-0 flex-1 pr-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-medium text-slate-900 group-hover:text-slate-950 transition-colors truncate">
                            {ride.title}
                          </span>
                          <span className="text-[10px] font-mono bg-slate-50 text-slate-500 border border-slate-200 px-1.5 py-0.2 rounded shrink-0">
                            {city}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {dateStr}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                        <div className="w-16 font-semibold text-slate-900">{distKm} <span className="text-[10px] text-slate-400 font-normal font-sans">km</span></div>
                        <div className="w-16 hidden sm:block">
                          {ride.avg_speed_kmh ? ride.avg_speed_kmh.toFixed(1) : '-'} <span className="text-[10px] text-slate-400 font-normal font-sans">km/h</span>
                        </div>
                        <div className="w-16 hidden md:block">
                          {ride.total_ascent_meters ? Math.round(ride.total_ascent_meters) : 0} <span className="text-[10px] text-slate-400 font-normal font-sans">m</span>
                        </div>
                        <div className="w-16 text-slate-500">{duration}</div>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRide(e, ride.id, ride.title)}
                          disabled={deletingId === ride.id}
                          className="p-1 rounded text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="删除此记录"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-5 text-center text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition-all">
                          <ChevronRight className="w-3.5 h-3.5 inline-block" />
                        </div>
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

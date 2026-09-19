import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  LayoutGrid, 
  List, 
  RefreshCw,
  RotateCcw,
  ArrowUpDown,
} from 'lucide-react';
import RideCard from '../components/RideCard';
import ActivitiesTableView from '../components/activities/ActivitiesTableView';
import { useApi } from '../hooks/useApi';
import ConfirmModal from '../components/common/ConfirmModal';
import { useActivityFilters, type ActivitySortOption } from '../hooks/useActivityFilters';
import { useActivityDelete } from '../hooks/useActivityDelete';

export default function ActivitiesList() {
  const navigate = useNavigate();
  // 统一取数：loading/error 由 useApi 托管，错误不再被静默吞掉
  const { data: fetchedRides, isLoading, error } = useApi<any[]>('/api/rides', (json) => json.rides || []);
  const [localRides, setLocalRides] = useState<any[] | null>(null);

  React.useEffect(() => {
    if (fetchedRides) {
      setLocalRides(fetchedRides);
    }
  }, [fetchedRides]);

  const rides = localRides ?? fetchedRides ?? [];

  const {
    searchQuery,
    setSearchQuery,
    cityFilter,
    setCityFilter,
    distanceFilter,
    setDistanceFilter,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    availableCities,
    filteredRides,
    isFiltered,
    resetFilters: handleResetFilters,
  } = useActivityFilters({ rides });

  const {
    deletingId,
    deleteConfirmDialog,
    deleteError,
    requestDelete: handleDeleteRequest,
    cancelDelete: handleCancelDelete,
    executeDelete,
  } = useActivityDelete({
    onDeleted: (rideId) => setLocalRides((prev) => (prev ? prev.filter((r) => r.id !== rideId) : [])),
  });

  return (
    <div className="h-full w-full bg-[#F8FAFC] flex flex-col text-slate-900 overflow-hidden">
      <main className="flex-1 h-full flex flex-col bg-white overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-16 px-4 md:px-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-tight">骑行档案</h1>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">共记录 {rides.length} 次骑行 · 已筛选 {filteredRides.length} 次</p>
          </div>

          <div className="flex items-center space-x-3 font-mono">
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="px-2.5 py-1.5 rounded-md text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center space-x-1 cursor-pointer"
                title="重置所有筛选条件"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                <span>重置筛选</span>
              </button>
            )}

            <div className="border border-slate-200 p-0.5 rounded-lg flex space-x-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-brand-500 text-white shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                }`}
                aria-label="网格卡片视图"
              >
                <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-brand-500 text-white shadow-2xs' : 'text-slate-400 hover:text-slate-700'
                }`}
                aria-label="紧凑表格视图"
              >
                <List className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        {/* Filters and Search Bar */}
        <div className="p-4 md:p-6 border-b border-slate-100 bg-white space-y-3 shrink-0">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="flex-1 min-w-[240px] relative font-mono">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="text"
                placeholder="搜索骑行名称..."
                aria-label="搜索骑行名称"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                className="w-full pl-8 pr-3 py-1.5 bg-white rounded border border-slate-200 text-base sm:text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 shadow-2xs transition-colors"
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
                    cityFilter === c.id ? 'bg-brand-500 text-white font-medium shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
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
                { id: 'all' as const, label: '全部' },
                { id: 'short' as const, label: '<15km' },
                { id: 'medium' as const, label: '15-30km' },
                { id: 'long' as const, label: '>30km' },
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDistanceFilter(d.id)}
                  className={`px-2 py-0.5 rounded text-xs transition-colors cursor-pointer ${
                    distanceFilter === d.id ? 'bg-brand-500 text-white font-medium shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              <select
                value={sortBy}
                aria-label="排序方式"
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
        <div className="flex-1 overflow-y-auto p-4 md:p-6 sm:p-4 md:p-8 [scrollbar-width:none]">
          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-slate-500 text-xs font-medium" role="status">
              <RefreshCw className="w-5 h-5 animate-spin mr-2 text-brand-500" />
              正在加载骑行列表...
            </div>
          ) : error ? (
            <div className="h-64 flex flex-col items-center justify-center bg-rose-50/60 rounded-2xl border border-rose-100 text-xs font-medium space-y-3" role="alert">
              <p className="text-rose-700">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-3.5 py-1.5 bg-brand-500 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-brand-600 transition-transform duration-150 active:scale-[0.96] cursor-pointer"
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
                  className="px-3.5 py-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded text-xs transition-colors cursor-pointer"
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
            <ActivitiesTableView
              rides={filteredRides}
              onRideClick={(rideId) => navigate(`/ride/${rideId}`, { state: { from: '/rides' } })}
              onDeleteRequest={handleDeleteRequest}
              deletingId={deletingId}
            />
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmDialog)}
        title="删除骑行记录"
        description={
          deleteConfirmDialog ? (
            <>
              确定要删除「<span className="font-medium text-slate-900">{deleteConfirmDialog.title}</span>」吗？此操作无法撤销。
            </>
          ) : null
        }
        confirmText="删除记录"
        cancelText="取消"
        isDanger={true}
        isLoading={deleteConfirmDialog ? deletingId === deleteConfirmDialog.id : false}
        loadingText="正在删除..."
        errorMessage={deleteError}
        onConfirm={executeDelete}
        onClose={handleCancelDelete}
      />
    </div>
  );
}

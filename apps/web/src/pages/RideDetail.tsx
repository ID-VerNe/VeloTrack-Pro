import React, { useState, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { RefreshCw, Lightbulb, X, ArrowLeft } from 'lucide-react';
import { exportRideAsGPX } from '../utils/gpxExport';

import RideDetailMap from '../components/ride-detail/RideDetailMap';
import RideTitleHeader from '../components/ride-detail/RideTitleHeader';
import RideMetricsGrid from '../components/ride-detail/RideMetricsGrid';
import SpeedSpectrumCard from '../components/ride-detail/SpeedSpectrumCard';
import RideElevationSpeedChart from '../components/ride-detail/RideElevationSpeedChart';
import RideInsightCard from '../components/ride-detail/RideInsightCard';
import { useRideDetailData } from '../hooks/useRideDetailData';
import { useRideTitleManager } from '../hooks/useRideTitleManager';
import { useRideTelemetryLinkage } from '../hooks/useRideTelemetryLinkage';

export default function RideDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // 返回按钮文案与实际来源匹配：骑行列表 → 返回骑行列表；历史 → 返回历史；其余 → 返回仪表盘
  const fromLabel =
    location.state?.from === '/rides' ? '返回骑行列表'
    : location.state?.from === '/history' ? '返回历史'
    : '返回仪表盘';

  const handleGoBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else {
      navigate('/');
    }
  };

  const handleNavigateAfterDelete = () => {
    if (location.state?.from) {
      navigate(location.state.from, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  // Ride Data, Performance Insight, Metrics & Deletion State
  const {
    ride,
    setRide,
    routeCoordinates,
    detailPoints,
    loadError,
    aiInsight,
    aiLoading,
    isCached,
    speedDist,
    calories,
    isDeleting,
    deleteError,
    loadData,
    fetchInsight,
    handleDeleteRide,
  } = useRideDetailData({
    id,
    onDeleteSuccess: handleNavigateAfterDelete,
  });

  // Title Polish, Edit & Undo Management
  const {
    isSuggestingTitle,
    suggestedTitle,
    previousTitle,
    saveTitleToBackend,
    handleAIPolishTitle,
    handleApplySuggestedTitle,
    handleCancelSuggestedTitle,
    handleUndoTitle,
  } = useRideTitleManager({ id, ride, setRide });

  // Map & Chart Bidirectional Telemetry Linkage
  const {
    isReversed,
    handleToggleReverse,
    effectiveRouteCoordinates,
    mapHoveredIndex,
    focusedRange,
    handleMapReady,
    handleChartHover,
    handleChartLeave,
    handleMapHoverPoint,
    handleMapLeavePoint,
    handleRangeZoom,
    handleJumpToPoint,
    handleSelectPauseCluster,
    handleSelectMilestone,
  } = useRideTelemetryLinkage({ id, ride, routeCoordinates });

  // 联动引导：仅首次访问展示，关闭后写入 localStorage 不再打扰
  const [showLinkHint, setShowLinkHint] = useState<boolean>(() => {
    return localStorage.getItem('velotrack_link_hint_dismissed') !== 'true';
  });
  const dismissLinkHint = useCallback(() => {
    setShowLinkHint(false);
    try {
      localStorage.setItem('velotrack_link_hint_dismissed', 'true');
    } catch {
      /* 忽略持久化失败 */
    }
  }, []);

  if (loadError) {
    return (
      <div className="h-screen w-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-slate-500 font-medium space-y-4">
        <div className="text-slate-600 text-sm">{loadError}</div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadData()}
            className="px-4 py-2 text-xs font-bold text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors shadow-2xs"
          >
            重试
          </button>
          <button
            onClick={handleGoBack}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            {fromLabel}
          </button>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="h-screen w-screen bg-[#F8FAFC] flex items-center justify-center text-slate-500 font-medium">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-brand-500" />
        正在加载骑行详情数据...
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white flex flex-col md:flex-row overflow-hidden font-sans">
      {/* 1. Left Map Panel */}
      <div className="flex-none h-[40dvh] md:flex-1 md:h-auto min-h-0 relative">
        {/* Mobile floating back button */}
        <button
          onClick={handleGoBack}
          aria-label={fromLabel}
          className="md:hidden absolute top-4 left-4 z-20 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center text-slate-700 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <RideDetailMap
          ride={ride}
          routeCoordinates={effectiveRouteCoordinates}
          detailPoints={detailPoints}
          isReversed={isReversed}
          focusedRange={focusedRange}
          onToggleReverse={handleToggleReverse}
          onMapReady={handleMapReady}
          onMapHoverPoint={handleMapHoverPoint}
          onMapLeavePoint={handleMapLeavePoint}
          onSelectMilestone={handleSelectMilestone}
          onSelectPauseCluster={handleSelectPauseCluster}
        />
      </div>

      {/* 2. Right Analytical Bento Dashboard */}
      <div className="w-full md:w-[520px] xl:w-[560px] flex-1 md:h-full bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col z-10 shrink-0 overflow-hidden">
        {/* Top Sticky Header */}
        <header className="px-4 md:px-4 md:px-8 py-4 md:py-8 bg-white shrink-0">
          <RideTitleHeader
            title={ride.title}
            fromLabel={fromLabel}
            onGoBack={handleGoBack}
            onOpenProfile={() => window.dispatchEvent(new CustomEvent('open-profile'))}
            onExportGPX={() => exportRideAsGPX(ride, effectiveRouteCoordinates)}
            onSaveTitle={saveTitleToBackend}
            onAIPolishTitle={handleAIPolishTitle}
            onApplySuggestedTitle={handleApplySuggestedTitle}
            onCancelSuggestedTitle={handleCancelSuggestedTitle}
            onUndoTitle={handleUndoTitle}
            onDelete={handleDeleteRide}
            isDeleting={isDeleting}
            deleteError={deleteError}
            isSuggestingTitle={isSuggestingTitle}
            suggestedTitle={suggestedTitle}
            previousTitle={previousTitle}
          />
        </header>

        {/* Scrollable Content Stream */}
        <div className="flex-1 overflow-y-auto px-4 md:px-4 md:px-8 pb-4 md:pb-8 space-y-6 md:space-y-8 [scrollbar-width:none]">
          {/* Bento Primary Metrics Grid (6-Card Enhanced) */}
          <RideMetricsGrid
            ride={ride}
            calories={calories}
            speedDistribution={speedDist}
          />

          {/* Speed Spectrum Breakdown Bar */}
          {speedDist && (
            <SpeedSpectrumCard
              tiers={speedDist.speed_tiers}
              totalDurationSeconds={ride.elapsed_time_seconds || ride.moving_time_seconds || 0}
            />
          )}

          {/* 首次访问引导：图表与地图双向联动 */}
          {showLinkHint && (
            <div className="flex items-start gap-3 px-5 py-4 bg-slate-50 rounded text-[13px] text-slate-600 font-normal leading-relaxed mt-4">
              <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
              <p className="flex-1">
                左侧地图与图表双向联动：悬停图表可在地图上定位游标，拖选图表区间会自动缩放地图聚焦；点击地图里程碑或停靠点也会在图表中高亮对应位置。
              </p>
              <button
                type="button"
                onClick={dismissLinkHint}
                aria-label="关闭引导提示"
                className="shrink-0 p-1 -m-1 rounded text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Interactive Elevation & Speed Profile with Micro-segmentation */}
          <RideElevationSpeedChart
            ride={ride}
            routeCoordinates={effectiveRouteCoordinates}
            detailPoints={detailPoints}
            cruisingSpeedKmh={speedDist?.cruising_avg_speed_kmh}
            externalHoverIndex={mapHoveredIndex}
            onHoverScrub={handleChartHover}
            onLeaveScrub={handleChartLeave}
            onRangeZoom={handleRangeZoom}
            onJumpToPoint={handleJumpToPoint}
          />

          {/* AI Kinetic & Physiological Diagnostics */}
          <RideInsightCard
            insight={aiInsight}
            isLoading={aiLoading}
            isCached={isCached}
            onRegenerate={() => fetchInsight(true)}
          />
        </div>
      </div>
    </div>
  );
}

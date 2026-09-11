import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import polyline from '@mapbox/polyline';
import { RefreshCw, Lightbulb, X } from 'lucide-react';
import { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl';
import { exportRideAsGPX } from '../utils/gpxExport';
import { calculateCyclingCalories } from '../utils/cyclingCalculations';
import { type ChartTelemetryPoint, type PauseCluster, type RideDetailPoint } from '../utils/telemetrySegments';

import RideDetailMap from '../components/ride-detail/RideDetailMap';
import RideTitleHeader from '../components/ride-detail/RideTitleHeader';
import RideMetricsGrid from '../components/ride-detail/RideMetricsGrid';
import SpeedSpectrumCard from '../components/ride-detail/SpeedSpectrumCard';
import RideElevationSpeedChart from '../components/ride-detail/RideElevationSpeedChart';
import RideInsightCard from '../components/ride-detail/RideInsightCard';
import RiderProfileDrawer from '../components/RiderProfileDrawer';
import { getRideInsight, suggestRideTitle } from '../services/aiInsights';
import { getRiderProfile } from '../services/riderService';
import { getAdminToken } from '../utils/activity/adminApiClient';
import { analyzeSpeedDistribution } from '../utils/speedDistribution';

export default function RideDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [ride, setRide] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  // R2 逐点实测明细（海拔/速度/时间），缺失时图表降级为示意模式
  const [detailPoints, setDetailPoints] = useState<RideDetailPoint[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [riderWeight, setRiderWeight] = useState<number>(75.0);

  // Title Polish & Edit State
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false);
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null);
  const [previousTitle, setPreviousTitle] = useState<string | null>(null);

  // Direction Reversal State (Persisted per ride in localStorage)
  const [isReversed, setIsReversed] = useState<boolean>(() => {
    return localStorage.getItem(`velotrack_ride_${id}_reversed`) === 'true';
  });

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

  const handleToggleReverse = useCallback(() => {
    setIsReversed((prev) => {
      const next = !prev;
      if (id) {
        localStorage.setItem(`velotrack_ride_${id}_reversed`, String(next));
      }
      return next;
    });
  }, [id]);

  const effectiveRouteCoordinates = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length === 0) return [];
    return isReversed ? [...routeCoordinates].reverse() : routeCoordinates;
  }, [routeCoordinates, isReversed]);

  // Bidirectional Interactive Linkage State
  const [mapHoveredIndex, setMapHoveredIndex] = useState<number | null>(null);
  const [focusedRange, setFocusedRange] = useState<{
    startProgress: number;
    endProgress: number;
  } | null>(null);

  // Performance Insight State
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);

  // Map & Marker References for bidirectional sync
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const scrubberMarkerRef = useRef<Marker | null>(null);
  const scrubberPopupRef = useRef<Popup | null>(null);

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

  // Fetch Rider Profile Weight
  useEffect(() => {
    getRiderProfile()
      .then((profile) => {
        if (profile.weight_kg) {
          setRiderWeight(profile.weight_kg);
        }
      })
      .catch((err) => console.error('Failed to load profile weight', err));
  }, []);

  // Fetch Ride Details
  // 修复：原先请求失败/404 只 console.error，UI 永远停在"正在加载"转圈。现在区分错误态并支持重试
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoadError(null);
    try {
      const res = await fetch(`/api/rides/${id}`);
      if (!res.ok) {
        setLoadError(res.status === 404 ? '骑行记录不存在或已被删除' : `加载失败（HTTP ${res.status}）`);
        return;
      }
      const data = await res.json();
      if (data.ride) {
        setRide(data.ride);
        // R2 逐点明细（实测海拔/速度/时间），缺失时图表降级为示意模式
        setDetailPoints(Array.isArray(data.detailPoints) ? data.detailPoints : null);
        if (data.ride.summary_polyline) {
          const rawCoords = polyline.decode(data.ride.summary_polyline);
          const formatted: [number, number][] = rawCoords.map((p) => [p[1], p[0]]);
          setRouteCoordinates(formatted);
        }
      } else {
        setLoadError('骑行数据格式异常');
      }
    } catch (err) {
      console.error('Failed to load ride detail', err);
      setLoadError('网络异常，无法加载骑行详情');
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch AI Insight（前端调 Gateway 生成，缓存存后端）
  const fetchInsight = useCallback(
    async (forceRegenerate = false) => {
      if (!id) return;
      setAiLoading(true);
      try {
        const result = await getRideInsight(id, forceRegenerate);
        if (result.insight) {
          setAiInsight(result.insight);
          setIsCached(result.cached);
        }
      } catch (err) {
        console.error('Failed to fetch AI insight', err);
      } finally {
        setAiLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    fetchInsight(false);
  }, [fetchInsight]);

  // Title Management
  const saveTitleToBackend = async (newTitle: string) => {
    if (!id || !newTitle.trim()) return;
    try {
      const res = await fetch(`/api/rides/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        setRide((prev: any) => (prev ? { ...prev, title: newTitle.trim() } : prev));
      }
    } catch (err) {
      console.error('Failed to update title', err);
    }
  };

  const handleAIPolishTitle = async () => {
    if (!id || !ride) return;
    setIsSuggestingTitle(true);
    try {
      const distKm = Number(((ride.distance_meters || 0) / 1000).toFixed(1));
      const result = await suggestRideTitle({
        start_time: ride.start_time,
        distance_km: distKm,
        avg_speed_kmh: ride.avg_speed_kmh || 0,
        total_ascent_meters: ride.total_ascent_meters || 0,
      });
      if (result.title && !result.title.includes('undefined')) {
        const polishedTitle = result.title.trim();
        const oldTitle = ride.title;
        setPreviousTitle(oldTitle);
        await saveTitleToBackend(polishedTitle);
        setSuggestedTitle(null);

        setTimeout(() => {
          setPreviousTitle((prev) => (prev === oldTitle ? null : prev));
        }, 8000);
      }
    } catch (err) {
      console.error('Failed to polish title with AI', err);
    } finally {
      setIsSuggestingTitle(false);
    }
  };

  const handleApplySuggestedTitle = async () => {
    if (!suggestedTitle || !ride) return;
    const oldTitle = ride.title;
    setPreviousTitle(oldTitle);
    await saveTitleToBackend(suggestedTitle);
    setSuggestedTitle(null);

    setTimeout(() => {
      setPreviousTitle((prev) => (prev === oldTitle ? null : prev));
    }, 8000);
  };

  const [isDeleting, setIsDeleting] = useState(false);

  const handleUndoTitle = async () => {
    if (!previousTitle || !ride) return;
    await saveTitleToBackend(previousTitle);
    setPreviousTitle(null);
  };

  const handleDeleteRide = async () => {
    if (!id) return;
    const token = getAdminToken();
    if (!token) {
      alert('未检测到管理令牌（ADMIN_TOKEN），无法执行删除操作。请先前往「数据入库」页面配置管理令牌。');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/rides/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Admin-Token': token,
        },
      });
      if (res.ok) {
        if (location.state?.from) {
          navigate(location.state.from, { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          alert('鉴权未通过：管理令牌无效或已过期，请前往「数据入库」页面重新配置有效令牌');
        } else {
          alert(data.error || '删除失败，请稍后重试');
        }
      }
    } catch (err: any) {
      console.error('Failed to delete ride', err);
      alert('网络错误，删除失败');
    } finally {
      setIsDeleting(false);
    }
  };

  // Map Scrubber Sync Handlers
  const handleMapReady = useCallback((map: MapLibreMap, marker: Marker, popup: Popup) => {
    mapInstanceRef.current = map;
    scrubberMarkerRef.current = marker;
    scrubberPopupRef.current = popup;
  }, []);

  const handleChartHover = useCallback(
    (point: ChartTelemetryPoint) => {
      if (!mapInstanceRef.current || effectiveRouteCoordinates.length === 0) return;
      const coordIndex =
        point.coordIndex !== undefined
          ? point.coordIndex
          : Math.min(
              effectiveRouteCoordinates.length - 1,
              Math.floor(
                (point.index / Math.max(1, (point.totalPoints || 45) - 1)) *
                  (effectiveRouteCoordinates.length - 1)
              )
            );
      const coord = effectiveRouteCoordinates[coordIndex] || effectiveRouteCoordinates[0];

      if (coord && scrubberMarkerRef.current) {
        scrubberMarkerRef.current.setLngLat(coord).addTo(mapInstanceRef.current);
        if (scrubberPopupRef.current) {
          const isPaused = point.status === 'paused';
          const isCruising = point.status === 'cruising';
          const isClimbing = point.status === 'climbing';
          const badgeColor = isPaused
            ? '#64748B'
            : isCruising
            ? '#059669'
            : isClimbing
            ? '#D97706'
            : '#2563EB';
          const badgeBg = isPaused
            ? '#F1F5F9'
            : isCruising
            ? '#ECFDF5'
            : isClimbing
            ? '#FEF3C7'
            : '#EFF6FF';

          scrubberPopupRef.current
            .setLngLat(coord)
            .setHTML(
              `<div style="padding: 8px; font-family: sans-serif; min-width: 140px; background: white; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 6px;">
                  <span style="font-weight: 600; font-size: 12px; color: #000; font-variant-numeric: tabular-nums;">${point.timeLabel}</span>
                  <span style="font-size: 10px; font-weight: 600; color: ${badgeColor}; background: ${badgeBg}; padding: 2px 6px; border-radius: 4px;">
                    ${isPaused ? '等红灯' : isCruising ? '稳态巡航' : isClimbing ? '起伏爬坡' : '正常骑行'}
                  </span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #64748B;">
                  <span>时速: <b style="color: #2563EB; font-variant-numeric: tabular-nums;">${point.speed}</b> km/h</span>
                  <span>海拔: <b style="color: #D97706; font-variant-numeric: tabular-nums;">${point.altitude}</b> m</span>
                </div>
              </div>`
            )
            .addTo(mapInstanceRef.current);
        }
      }
    },
    [effectiveRouteCoordinates]
  );

  const handleChartLeave = useCallback(() => {
    if (scrubberMarkerRef.current) scrubberMarkerRef.current.remove();
    if (scrubberPopupRef.current) scrubberPopupRef.current.remove();
  }, []);

  // Bidirectional Reverse Handlers: Map -> Chart
  const handleMapHoverPoint = useCallback((chartIdx: number) => {
    setMapHoveredIndex(chartIdx);
  }, []);

  const handleMapLeavePoint = useCallback(() => {
    setMapHoveredIndex(null);
  }, []);

  const handleRangeZoom = useCallback(
    (range: { startIdx: number; endIdx: number; startProgress: number; endProgress: number } | null) => {
      setFocusedRange(range ? { startProgress: range.startProgress, endProgress: range.endProgress } : null);
    },
    []
  );

  const handleJumpToPoint = useCallback(
    (point: ChartTelemetryPoint) => {
      handleChartHover(point);
      if (mapInstanceRef.current && point.coord) {
        mapInstanceRef.current.easeTo({
          center: point.coord,
          zoom: 14.5,
          duration: 700,
        });
      }
    },
    [handleChartHover]
  );

  const handleSelectPauseCluster = useCallback(
    (cluster: PauseCluster) => {
      if (mapInstanceRef.current && cluster.coord) {
        mapInstanceRef.current.easeTo({
          center: cluster.coord,
          zoom: 15,
          duration: 600,
        });
      }
      setMapHoveredIndex(Math.round((cluster.coordIndex / Math.max(1, effectiveRouteCoordinates.length)) * 45));
    },
    [effectiveRouteCoordinates]
  );

  const handleSelectMilestone = useCallback(
    (km: number) => {
      const progress = km / Math.max(1, (ride?.distance_meters || 1000) / 1000);
      setMapHoveredIndex(Math.round(progress * 45));
    },
    [ride]
  );

  const movingAvgSpeedKmh = useMemo(() => {
    if (!ride) return 0;
    const movingSec = ride.moving_time_seconds || ride.elapsed_time_seconds || 1;
    return movingSec > 0 ? Number(((ride.distance_meters / 1000) / (movingSec / 3600)).toFixed(1)) : 0;
  }, [ride]);

  const speedDist = useMemo(() => {
    if (!ride) return null;
    return analyzeSpeedDistribution(detailPoints, movingAvgSpeedKmh, 46, 15);
  }, [ride, detailPoints, movingAvgSpeedKmh]);

  const calories = useMemo(() => {
    if (!ride) return 0;
    const totalSeconds = ride.moving_time_seconds || ride.elapsed_time_seconds || 0;
    return calculateCyclingCalories(
      (ride.distance_meters || 0) / 1000,
      totalSeconds,
      ride.avg_speed_kmh || 0,
      ride.total_ascent_meters || 0,
      riderWeight
    );
  }, [ride, riderWeight]);

  if (loadError) {
    return (
      <div className="h-screen w-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-slate-500 font-medium space-y-4">
        <div className="text-slate-600 text-sm">{loadError}</div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => loadData()}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
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
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
        正在加载骑行详情数据...
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-white flex overflow-hidden font-sans select-none">
      {/* 1. Left Map Panel */}
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

      {/* 2. Right Analytical Bento Dashboard */}
      <div className="w-[520px] xl:w-[560px] h-full bg-white border-l border-black/10 flex flex-col z-10 shrink-0 overflow-hidden">
        {/* Top Sticky Header */}
        <header className="px-8 py-8 bg-white shrink-0">
          <RideTitleHeader
            title={ride.title}
            fromLabel={fromLabel}
            onGoBack={handleGoBack}
            onOpenProfile={() => setIsProfileOpen(true)}
            onExportGPX={() => exportRideAsGPX(ride, effectiveRouteCoordinates)}
            onSaveTitle={saveTitleToBackend}
            onAIPolishTitle={handleAIPolishTitle}
            onApplySuggestedTitle={handleApplySuggestedTitle}
            onCancelSuggestedTitle={() => setSuggestedTitle(null)}
            onUndoTitle={handleUndoTitle}
            onDelete={handleDeleteRide}
            isDeleting={isDeleting}
            isSuggestingTitle={isSuggestingTitle}
            suggestedTitle={suggestedTitle}
            previousTitle={previousTitle}
          />
        </header>

        {/* Scrollable Content Stream */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8 [scrollbar-width:none]">
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
            <div className="flex items-start gap-3 px-5 py-4 bg-black/5 rounded text-[13px] text-black/80 font-normal leading-relaxed mt-4">
              <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-black/44" />
              <p className="flex-1">
                左侧地图与图表双向联动：悬停图表可在地图上定位游标，拖选图表区间会自动缩放地图聚焦；点击地图里程碑或停靠点也会在图表中高亮对应位置。
              </p>
              <button
                type="button"
                onClick={dismissLinkHint}
                aria-label="关闭引导提示"
                className="shrink-0 p-1 -m-1 rounded text-black/44 hover:text-black transition-colors cursor-pointer"
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

      {/* Rider Profile Configuration Drawer */}
      <RiderProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
}

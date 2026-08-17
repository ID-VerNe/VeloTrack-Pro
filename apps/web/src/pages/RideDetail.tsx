import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import polyline from '@mapbox/polyline';
import { RefreshCw } from 'lucide-react';
import { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl';
import { exportRideAsGPX } from '../utils/gpxExport';
import { calculateCyclingCalories } from '../utils/cyclingCalculations';
import { type ChartTelemetryPoint, type PauseCluster } from '../utils/telemetrySegments';

import RideDetailMap from '../components/ride-detail/RideDetailMap';
import RideTitleHeader from '../components/ride-detail/RideTitleHeader';
import RideMetricsGrid from '../components/ride-detail/RideMetricsGrid';
import RideElevationSpeedChart from '../components/ride-detail/RideElevationSpeedChart';
import RideInsightCard from '../components/ride-detail/RideInsightCard';
import RiderProfileDrawer from '../components/RiderProfileDrawer';

export default function RideDetail() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const [ride, setRide] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
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

  const fromLabel = location.state?.from === '/history' ? '返回历史' : '返回仪表盘';

  const handleGoBack = () => {
    if (location.state?.from) {
      navigate(location.state.from);
    } else {
      navigate('/');
    }
  };

  // Fetch Rider Profile Weight
  useEffect(() => {
    fetch('/api/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile?.weight_kg) {
          setRiderWeight(data.profile.weight_kg);
        }
      })
      .catch((err) => console.error('Failed to load profile weight', err));
  }, []);

  // Fetch Ride Details
  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/rides/${id}`);
      const data = await res.json();
      if (data.ride) {
        setRide(data.ride);
        if (data.ride.summary_polyline) {
          const rawCoords = polyline.decode(data.ride.summary_polyline);
          const formatted: [number, number][] = rawCoords.map((p) => [p[1], p[0]]);
          setRouteCoordinates(formatted);
        }
      }
    } catch (err) {
      console.error('Failed to load ride detail', err);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Fetch AI Insight
  const fetchInsight = useCallback(
    async (forceRegenerate = false) => {
      if (!id) return;
      setAiLoading(true);
      try {
        const url = forceRegenerate
          ? `/api/rides/${id}/insight?regenerate=true`
          : `/api/rides/${id}/insight`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.insight) {
          setAiInsight(data.insight);
          setIsCached(!!data.cached);
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
      await fetch(`/api/rides/${id}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      setRide((prev: any) => (prev ? { ...prev, title: newTitle.trim() } : prev));
    } catch (err) {
      console.error('Failed to update title', err);
    }
  };

  const handleAIPolishTitle = async () => {
    if (!id || !ride) return;
    setIsSuggestingTitle(true);
    try {
      const res = await fetch(`/api/rides/${id}/title/suggest`, { method: 'POST' });
      const data = await res.json();
      if (data.suggested_title) {
        setSuggestedTitle(data.suggested_title);
      }
    } catch (err) {
      console.error('Failed to polish title with AI', err);
    } finally {
      setIsSuggestingTitle(false);
    }
  };

  const handleApplySuggestedTitle = async () => {
    if (!suggestedTitle || !ride) return;
    setPreviousTitle(ride.title);
    await saveTitleToBackend(suggestedTitle);
    setSuggestedTitle(null);

    setTimeout(() => {
      setPreviousTitle(null);
    }, 6000);
  };

  const handleUndoTitle = async () => {
    if (!previousTitle || !ride) return;
    await saveTitleToBackend(previousTitle);
    setPreviousTitle(null);
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
            ? '#E11D48'
            : isCruising
            ? '#2563EB'
            : isClimbing
            ? '#D97706'
            : '#0F172A';
          const badgeBg = isPaused
            ? '#FFE4E6'
            : isCruising
            ? '#DBEAFE'
            : isClimbing
            ? '#FEF3C7'
            : '#F1F5F9';

          scrubberPopupRef.current
            .setLngLat(coord)
            .setHTML(
              `<div style="padding: 4px 6px; font-family: sans-serif; min-width: 130px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 3px;">
                  <span style="font-weight: 800; font-size: 11px; color: #0F172A; font-family: monospace;">⏱️ ${point.timeLabel}</span>
                  <span style="font-size: 9px; font-weight: 800; color: ${badgeColor}; background: ${badgeBg}; padding: 1px 4px; border-radius: 4px;">
                    ${isPaused ? '等红灯' : isCruising ? '高速巡航' : isClimbing ? '起伏爬坡' : '匀速'}
                  </span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #475569;">
                  <span>时速: <b style="color: #2563EB; font-family: monospace;">${point.speed} km/h</b></span>
                  <span>海拔: <b style="color: #059669; font-family: monospace;">${point.altitude} m</b></span>
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

  if (!ride) {
    return (
      <div className="h-screen w-screen bg-[#F8FAFC] flex items-center justify-center text-slate-400 font-medium">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-600" />
        正在加载骑行详情数据...
      </div>
    );
  }

  const totalSeconds = ride.moving_time_seconds || ride.elapsed_time_seconds || 0;
  const calories = calculateCyclingCalories(
    (ride.distance_meters || 0) / 1000,
    totalSeconds,
    ride.avg_speed_kmh || 0,
    ride.total_ascent_meters || 0,
    riderWeight
  );

  return (
    <div className="h-screen w-screen bg-[#F8FAFC] flex overflow-hidden font-sans select-none">
      {/* 1. Left Map Panel */}
      <RideDetailMap
        ride={ride}
        routeCoordinates={effectiveRouteCoordinates}
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
      <div className="w-[500px] xl:w-[540px] h-full bg-white border-l border-slate-200/80 flex flex-col z-10 shadow-2xl shrink-0 overflow-hidden">
        {/* Top Sticky Header */}
        <header className="px-6 py-4 border-b border-slate-100 bg-white/95 backdrop-blur-md shrink-0 shadow-2xs">
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
            isSuggestingTitle={isSuggestingTitle}
            suggestedTitle={suggestedTitle}
            previousTitle={previousTitle}
          />
        </header>

        {/* Scrollable Content Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 [scrollbar-width:none]">
          {/* Bento Primary Metrics Grid */}
          <RideMetricsGrid ride={ride} calories={calories} />

          {/* Interactive Elevation & Speed Profile with Micro-segmentation */}
          <RideElevationSpeedChart
            ride={ride}
            routeCoordinates={effectiveRouteCoordinates}
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

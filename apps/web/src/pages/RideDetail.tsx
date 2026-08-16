import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { type Map as MapLibreMap, type Marker, type Popup } from 'maplibre-gl';
import polyline from '@mapbox/polyline';
import { RefreshCw } from 'lucide-react';

import { detectCityForRide } from '../utils/geoUtils';
import { calculateCyclingCalories } from '../utils/cyclingCalculations';
import { exportRideAsGPX } from '../utils/gpxExport';
import RiderProfileDrawer from '../components/RiderProfileDrawer';

import RideDetailMap from '../components/ride-detail/RideDetailMap';
import RideElevationSpeedChart from '../components/ride-detail/RideElevationSpeedChart';
import RideTitleHeader from '../components/ride-detail/RideTitleHeader';
import RideInsightCard from '../components/ride-detail/RideInsightCard';
import RideMetricsGrid from '../components/ride-detail/RideMetricsGrid';

export default function RideDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const scrubberMarkerRef = useRef<Marker | null>(null);
  const scrubberPopupRef = useRef<Popup | null>(null);

  const [ride, setRide] = useState<any>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [riderWeight, setRiderWeight] = useState(58);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Title Editing & AI Suggestion State
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false);
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null);
  const [previousTitle, setPreviousTitle] = useState<string | null>(null);

  // Performance Insight State
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);

  const fromPath = (location.state as any)?.from;
  const fromLabel = fromPath?.includes('/rides')
    ? '返回活动档案库'
    : fromPath?.includes('/reports')
    ? '返回周期总结'
    : '返回仪表盘';

  const handleGoBack = () => {
    if (fromPath) navigate(fromPath);
    else navigate(-1);
  };

  // 1. Load Ride & Rider Profile Data
  useEffect(() => {
    fetch(`/api/rides/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ride) {
          setRide(data.ride);
          if (data.ride.summary_polyline) {
            try {
              const rawCoords = polyline.decode(data.ride.summary_polyline);
              const coords: [number, number][] = rawCoords.map((p) => [p[1], p[0]]);
              setRouteCoordinates(coords);
            } catch (err) {
              console.error('Failed to decode polyline:', err);
            }
          }
        }
      })
      .catch(console.error);

    fetch('/api/ai/rider/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile?.weight_kg) setRiderWeight(data.profile.weight_kg);
      })
      .catch(() => {});
  }, [id]);

  const cityName = useMemo(() => (ride ? detectCityForRide(ride) : '城市'), [ride]);

  // 2. Fetch or Regenerate Insight
  const fetchInsight = useCallback(
    (force = false) => {
      if (!id) return;
      setAiLoading(true);
      const url = force ? `/api/ai/rides/${id}/insight?force=true` : `/api/ai/rides/${id}/insight`;
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          if (data.insight) {
            setAiInsight(data.insight);
            setIsCached(Boolean(data.cached));
          }
        })
        .catch(console.error)
        .finally(() => setAiLoading(false));
    },
    [id]
  );

  useEffect(() => {
    if (ride && !aiInsight && !aiLoading) {
      fetchInsight(false);
    }
  }, [ride, aiInsight, aiLoading, fetchInsight]);

  // Save Title
  const saveTitleToBackend = async (newTitle: string) => {
    if (!id || !newTitle.trim()) return;
    try {
      const res = await fetch(`/api/rides/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        setRide((prev: any) => ({ ...prev, title: newTitle.trim() }));
      }
    } catch (err) {
      console.error('Failed to save title:', err);
    }
  };

  // AI Title Suggestion
  const handleAIPolishTitle = async () => {
    if (!ride || isSuggestingTitle) return;
    setIsSuggestingTitle(true);
    try {
      const res = await fetch('/api/ai/rides/suggest-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: ride.start_time,
          distance_km: Number(((ride.distance_meters || 0) / 1000).toFixed(1)),
          avg_speed_kmh: ride.avg_speed_kmh || 0,
          total_ascent_meters: ride.total_ascent_meters || 0,
          city: cityName,
        }),
      });
      const data = await res.json();
      if (data.title && !data.title.includes('undefined')) {
        setSuggestedTitle(data.title);
      }
    } catch (err) {
      console.error(err);
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
      setPreviousTitle(null);
    }, 6000);
  };

  const handleUndoTitle = async () => {
    if (!previousTitle || !ride) return;
    await saveTitleToBackend(previousTitle);
    setPreviousTitle(null);
  };

  // Map Scrubber Sync Handler
  const handleMapReady = useCallback((map: MapLibreMap, marker: Marker, popup: Popup) => {
    mapInstanceRef.current = map;
    scrubberMarkerRef.current = marker;
    scrubberPopupRef.current = popup;
  }, []);

  const handleChartHover = useCallback(
    (dataIndex: number) => {
      if (!mapInstanceRef.current || routeCoordinates.length === 0) return;
      const numPoints = 30;
      const progress = dataIndex / numPoints;
      const coordIndex = Math.min(
        routeCoordinates.length - 1,
        Math.floor(progress * routeCoordinates.length)
      );
      const coord = routeCoordinates[coordIndex];

      if (coord && scrubberMarkerRef.current) {
        scrubberMarkerRef.current.setLngLat(coord).addTo(mapInstanceRef.current);
        if (scrubberPopupRef.current) {
          scrubberPopupRef.current
            .setLngLat(coord)
            .setHTML(
              `<div style="font-weight: bold; font-size: 11px; padding: 2px 4px; color: #0F172A; white-space: nowrap;">
                同步点位
              </div>`
            )
            .addTo(mapInstanceRef.current);
        }
      }
    },
    [routeCoordinates]
  );

  const handleChartLeave = useCallback(() => {
    if (scrubberMarkerRef.current) scrubberMarkerRef.current.remove();
    if (scrubberPopupRef.current) scrubberPopupRef.current.remove();
  }, []);

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
    <div className="h-screen w-screen bg-[#F8FAFC] font-sans flex flex-col lg:flex-row overflow-hidden select-none">
      {/* Left Map Workspace (58%) */}
      <div className="flex-1 lg:flex-[58] h-1/2 lg:h-full relative overflow-hidden bg-slate-100 min-w-0">
        <RideDetailMap
          routeCoordinates={routeCoordinates}
          onMapReady={handleMapReady}
        />
      </div>

      {/* Right Dashboard Workspace (42%) */}
      <div className="flex-1 lg:flex-[42] h-1/2 lg:h-full bg-[#F8FAFC] overflow-y-auto p-6 sm:p-8 space-y-6 [scrollbar-width:none]">
        {/* Title Header */}
        <RideTitleHeader
          title={ride.title}
          fromLabel={fromLabel}
          isSuggestingTitle={isSuggestingTitle}
          suggestedTitle={suggestedTitle}
          previousTitle={previousTitle}
          onGoBack={handleGoBack}
          onSaveTitle={saveTitleToBackend}
          onAIPolishTitle={handleAIPolishTitle}
          onApplySuggestedTitle={handleApplySuggestedTitle}
          onCancelSuggestedTitle={() => setSuggestedTitle(null)}
          onUndoTitle={handleUndoTitle}
          onExportGPX={() => exportRideAsGPX(ride, routeCoordinates)}
          onOpenProfile={() => setIsProfileOpen(true)}
        />

        {/* Bento Metrics Grid */}
        <RideMetricsGrid ride={ride} calories={calories} />

        {/* Elevation and Speed Dual-Axis Interactive Chart */}
        <RideElevationSpeedChart
          ride={ride}
          onHoverScrub={handleChartHover}
          onLeaveScrub={handleChartLeave}
        />

        {/* AI Performance Insight Card */}
        <RideInsightCard
          insight={aiInsight}
          isLoading={aiLoading}
          isCached={isCached}
          onRegenerate={() => fetchInsight(true)}
        />
      </div>

      {/* Rider Profile Drawer */}
      <RiderProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </div>
  );
}

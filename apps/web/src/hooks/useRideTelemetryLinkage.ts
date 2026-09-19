// apps/web/src/hooks/useRideTelemetryLinkage.ts
//
// 骑行地图与图表双向联动 Hook
// 遵循单一职责（SRP）原则，集中托管轨迹方向反转、地图游标（Scrubber）插值同步、图表悬停联动、停顿点与里程碑聚焦。

import { useState, useCallback, useMemo, useRef } from 'react';
import { Map as MapLibreMap, Marker, Popup } from 'maplibre-gl';
import { type ChartTelemetryPoint, type PauseCluster } from '../utils/telemetrySegments';

export interface UseRideTelemetryLinkageParams {
  id?: string;
  ride: any;
  routeCoordinates: [number, number][];
}

export function useRideTelemetryLinkage({
  id,
  ride,
  routeCoordinates,
}: UseRideTelemetryLinkageParams) {
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

  // Map & Marker References for bidirectional sync
  const mapInstanceRef = useRef<MapLibreMap | null>(null);
  const scrubberMarkerRef = useRef<Marker | null>(null);
  const scrubberPopupRef = useRef<Popup | null>(null);

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
            : '#395AA7';
          const badgeBg = isPaused
            ? '#F1F5F9'
            : isCruising
            ? '#ECFDF5'
            : isClimbing
            ? '#FEF3C7'
            : '#F0F4FC';

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
                  <span>时速: <b style="color: #395AA7; font-variant-numeric: tabular-nums;">${point.speed}</b> km/h</span>
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

  return {
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
  };
}

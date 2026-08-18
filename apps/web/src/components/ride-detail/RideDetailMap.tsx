import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Map as MapLibreMap, LngLatBounds, Marker, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus, Minus, Maximize2, Flame, ArrowLeftRight } from 'lucide-react';

import { MAP_STYLES, type MapStyleKey } from '../../utils/mapStyles';
import { MAP_STYLE_VISUALS } from '../../utils/mapVisualConfigs';
import { adaptCoordinatesToMapStyle } from '../../utils/coordTransform';
import { useMapStyle } from '../../contexts/MapStyleContext';
import {
  analyzeRideTelemetry,
  computeDistanceMeters,
  findClosestTelemetryIndex,
  type PauseCluster,
  type RideDetailPoint,
} from '../../utils/telemetrySegments';
import {
  createStartMarker,
  createFinishMarker,
  createMilestoneMarker,
  createPauseMarker,
  createScrubberMarker,
} from './mapMarkerFactory';

interface Props {
  ride: any;
  routeCoordinates: [number, number][];
  /** R2 逐点实测明细（海拔/速度/时间），缺失时降级为示意分析 */
  detailPoints?: RideDetailPoint[] | null;
  isReversed?: boolean;
  focusedRange?: { startProgress: number; endProgress: number } | null;
  onToggleReverse?: () => void;
  onMapReady?: (map: MapLibreMap, marker: Marker, popup: Popup) => void;
  onMapHoverPoint?: (chartIndex: number) => void;
  onMapLeavePoint?: () => void;
  onSelectMilestone?: (km: number) => void;
  onSelectPauseCluster?: (cluster: PauseCluster) => void;
}

export default function RideDetailMap({
  ride,
  routeCoordinates,
  detailPoints = null,
  isReversed,
  focusedRange,
  onToggleReverse,
  onMapReady,
  onMapHoverPoint,
  onMapLeavePoint,
  onSelectMilestone,
  onSelectPauseCluster,
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const scrubberMarkerRef = useRef<Marker | null>(null);
  const scrubberPopupRef = useRef<Popup | null>(null);
  const customMarkersRef = useRef<Marker[]>([]);

  // 底图偏好全局共享：与仪表盘联动，localStorage 持久化
  const { mapStyle: activeStyle, setMapStyle: setActiveStyle } = useMapStyle();
  const [showHeatmapLegend] = useState(true);

  // Build segmented GeoJSON with velocity colors and milestones
  const buildRouteLayers = useCallback(
    (map: MapLibreMap, styleKey: MapStyleKey) => {
      if (!routeCoordinates || routeCoordinates.length === 0) return;

      const visual = MAP_STYLE_VISUALS[styleKey] || MAP_STYLE_VISUALS.light;
      const adaptedCoords = adaptCoordinatesToMapStyle(routeCoordinates, styleKey);

      // Clear existing custom markers
      customMarkersRef.current.forEach((m) => m.remove());
      customMarkersRef.current = [];

      // Perform dynamic telemetry & pause cluster analysis
      const { pauseClusters, stats, stepDistances, telemetryPoints } = analyzeRideTelemetry(
        ride,
        routeCoordinates,
        detailPoints
      );

      const movingSteps = stepDistances.filter((d) => d >= 3.2);
      const avgMovingStep =
        movingSteps.length > 0
          ? movingSteps.reduce((a, b) => a + b, 0) / movingSteps.length
          : 15;

      const pauseCoordIndices = new Set(pauseClusters.map((pc) => pc.coordIndex));

      // 1. Build Multi-segment colored GeoJSON features
      const numCoords = adaptedCoords.length;
      const features: any[] = [];
      let accumulatedMeters = 0;
      let nextMilestoneKm = 5;

      for (let i = 0; i < numCoords - 1; i++) {
        const p1 = adaptedCoords[i];
        const p2 = adaptedCoords[i + 1];
        const dist = computeDistanceMeters(p1, p2);
        accumulatedMeters += dist;

        const isPauseZone =
          (stepDistances[i] !== undefined && stepDistances[i] < 3.2) ||
          pauseCoordIndices.has(i) ||
          pauseCoordIndices.has(i + 1);

        let speedKmh = 0;
        let segmentColor = '#EF4444'; // Red (Pause)
        let segmentStatus = 'paused';

        if (!isPauseZone) {
          const rawDist = stepDistances[i] || dist;
          const normalizedSpeed = (rawDist / Math.max(1, avgMovingStep)) * stats.movingAvgSpeedKmh;
          speedKmh = Number(Math.max(6.0, Math.min(stats.maxSpeedKmh, normalizedSpeed)).toFixed(1));

          if (speedKmh >= 23) {
            segmentColor = '#2563EB'; // Royal Blue (Sprint)
            segmentStatus = 'sprint';
          } else if (speedKmh >= 17) {
            segmentColor = '#10B981'; // Emerald Cruising
            segmentStatus = 'cruising';
          } else {
            segmentColor = '#F59E0B'; // Amber Orange
            segmentStatus = 'tempo';
          }
        }

        features.push({
          type: 'Feature',
          properties: {
            color: segmentColor,
            speed: speedKmh,
            status: segmentStatus,
            segmentIndex: i,
          },
          geometry: {
            type: 'LineString',
            coordinates: [p1, p2],
          },
        });

        // Place 5km Milestones
        const accumulatedKm = accumulatedMeters / 1000;
        if (accumulatedKm >= nextMilestoneKm && nextMilestoneKm < accumulatedMeters / 1000 + 5) {
          const currentKmVal = nextMilestoneKm;
          const mMarker = createMilestoneMarker(
            currentKmVal,
            p2,
            visual.milestoneClass,
            onSelectMilestone
          ).addTo(map);
          customMarkersRef.current.push(mMarker);
          nextMilestoneKm += 5;
        }
      }

      // Add Source
      if (map.getSource('route-source')) {
        (map.getSource('route-source') as any).setData({
          type: 'FeatureCollection',
          features,
        });
      } else {
        map.addSource('route-source', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features,
          },
        });
      }

      // Remove existing route layers before re-adding
      ['route-glow', 'route-casing', 'route-inner', 'route-hit-target'].forEach((layerId) => {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
      });

      // 1. Glow Base Layer (if style provides one)
      if (visual.glowColor) {
        map.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route-source',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': visual.glowColor,
            'line-width': visual.glowWidth || 10,
            'line-opacity': visual.glowOpacity || 0.5,
            'line-blur': visual.glowBlur || 2,
          },
        });
      }

      // 2. High-contrast Outer Casing Layer
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': visual.casingColor,
          'line-width': visual.casingWidth,
          'line-opacity': visual.casingOpacity,
        },
      });

      // 3. Inner Colored Velocity Gradient Layer
      map.addLayer({
        id: 'route-inner',
        type: 'line',
        source: 'route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': visual.innerWidth,
          'line-opacity': 1,
        },
      });

      // 4. Interactive Transparent Hit-Target Layer for Map -> Chart Scrubbing
      map.addLayer({
        id: 'route-hit-target',
        type: 'line',
        source: 'route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-width': 26,
          'line-opacity': 0.001,
          'line-color': '#000000',
        },
      });

      map.on('mouseenter', 'route-hit-target', () => {
        map.getCanvas().style.cursor = 'crosshair';
      });

      map.on('mousemove', 'route-hit-target', (e) => {
        if (!e.lngLat) return;
        const targetCoord: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        const closest = findClosestTelemetryIndex(
          targetCoord,
          adaptedCoords,
          telemetryPoints.length
        );
        if (closest.chartIndex !== undefined) {
          onMapHoverPoint?.(closest.chartIndex);
        }
      });

      map.on('mouseleave', 'route-hit-target', () => {
        map.getCanvas().style.cursor = '';
        onMapLeavePoint?.();
      });

      // Start Marker
      const sMarker = createStartMarker(adaptedCoords[0]).addTo(map);
      customMarkersRef.current.push(sMarker);

      // Finish Marker
      if (adaptedCoords.length > 1) {
        const fMarker = createFinishMarker(adaptedCoords[adaptedCoords.length - 1]).addTo(map);
        customMarkersRef.current.push(fMarker);
      }

      // Dynamic Pause Clusters
      pauseClusters.forEach((cluster) => {
        const targetAdaptedCoord = adaptedCoords[cluster.coordIndex] || adaptedCoords[0];
        const pMarker = createPauseMarker(
          cluster,
          targetAdaptedCoord,
          onSelectPauseCluster
        ).addTo(map);
        customMarkersRef.current.push(pMarker);
      });
    },
    [
      ride,
      routeCoordinates,
      onMapHoverPoint,
      onMapLeavePoint,
      onSelectMilestone,
      onSelectPauseCluster,
    ]
  );

  // Initialize Map
  useEffect(() => {
    if (!mapContainer.current || routeCoordinates.length === 0) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const adaptedCoords = adaptCoordinatesToMapStyle(routeCoordinates, activeStyle);
    const startCoord = adaptedCoords[0];
    const map = new MapLibreMap({
      container: mapContainer.current,
      style: MAP_STYLES[activeStyle].style,
      center: startCoord,
      zoom: 12,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.resize();
      buildRouteLayers(map, activeStyle);

      const bounds = new LngLatBounds();
      adaptedCoords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 60, duration: 800 });

      // Scrubber Marker for ECharts scrub synchronization
      const { marker: scrubberMarker, popup } = createScrubberMarker();
      scrubberMarkerRef.current = scrubberMarker;
      scrubberPopupRef.current = popup;

      if (onMapReady) {
        onMapReady(map, scrubberMarker, popup);
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [routeCoordinates, activeStyle, buildRouteLayers, onMapReady]);

  // Handle Dynamic Sub-Range Zoom Sync from Chart
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded() || !focusedRange || routeCoordinates.length === 0)
      return;
    const adaptedCoords = adaptCoordinatesToMapStyle(routeCoordinates, activeStyle);
    const total = adaptedCoords.length;
    const startIdx = Math.max(0, Math.min(total - 1, Math.floor(focusedRange.startProgress * (total - 1))));
    const endIdx = Math.max(0, Math.min(total - 1, Math.ceil(focusedRange.endProgress * (total - 1))));

    if (endIdx > startIdx) {
      const subBounds = new LngLatBounds();
      for (let i = startIdx; i <= endIdx; i++) {
        subBounds.extend(adaptedCoords[i]);
      }
      mapRef.current.fitBounds(subBounds, { padding: 80, duration: 600 });
    }
  }, [focusedRange, routeCoordinates, activeStyle]);

  // Handle Map Style Switch
  const handleStyleChange = (styleKey: MapStyleKey) => {
    setActiveStyle(styleKey);
    if (!mapRef.current) return;

    const map = mapRef.current;
    map.setStyle(MAP_STYLES[styleKey].style);

    map.once('style.load', () => {
      buildRouteLayers(map, styleKey);
      const adaptedCoords = adaptCoordinatesToMapStyle(routeCoordinates, styleKey);
      const bounds = new LngLatBounds();
      adaptedCoords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 60, duration: 400 });
    });
  };

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleFitBounds = () => {
    if (!mapRef.current || routeCoordinates.length === 0) return;
    const adaptedCoords = adaptCoordinatesToMapStyle(routeCoordinates, activeStyle);
    const bounds = new LngLatBounds();
    adaptedCoords.forEach((c) => bounds.extend(c));
    mapRef.current.fitBounds(bounds, { padding: 60, duration: 600 });
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-100 min-w-0">
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ filter: 'contrast(96%) brightness(102%) saturate(95%)' }}
      />

      {/* Top Floating Map Style Switcher & Reversal Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-1.5 bg-white/90 backdrop-blur-md p-1 rounded-2xl shadow-lg border border-slate-200/80">
        {(
          [
            { id: 'light', name: '浅色', icon: '☀️' },
            { id: 'dark', name: '夜航', icon: '🌙' },
            { id: 'satellite', name: '卫星', icon: '🛰️' },
            { id: 'terrain', name: '地形', icon: '⛰️' },
          ] as const
        ).map((item) => {
          const isActive = activeStyle === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleStyleChange(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer active:scale-95 ${
                isActive
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="text-xs">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          );
        })}

        {onToggleReverse && (
          <>
            <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />
            <button
              onClick={onToggleReverse}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer active:scale-95 ${
                isReversed
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
              title="反转起点与终点方向"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{isReversed ? '已反转起终点' : '反转起终点'}</span>
            </button>
          </>
        )}
      </div>

      {/* Speed Gradient Color Heatmap Legend */}
      {showHeatmapLegend && (
        <div className="absolute bottom-6 left-4 z-20 bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-2.5 rounded-2xl shadow-lg border border-slate-800 flex items-center space-x-3 text-xs font-bold">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>速度谱系:</span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
              <span className="text-slate-300 font-mono">停顿/低速</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
              <span className="text-slate-300 font-mono">起步/爬坡</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
              <span className="text-emerald-400 font-mono">巡航甜点</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2563EB]" />
              <span className="text-blue-400 font-mono">冲刺提拉</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Zoom & Controls */}
      <div className="absolute right-4 bottom-6 z-20 flex flex-col space-y-1.5">
        <button
          onClick={handleFitBounds}
          className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-md border border-slate-200/80 transition-all active:scale-95 cursor-pointer"
          title="适应全部轨迹"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomIn}
          className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-md border border-slate-200/80 transition-all active:scale-95 cursor-pointer"
          title="放大"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-md border border-slate-200/80 transition-all active:scale-95 cursor-pointer"
          title="缩小"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

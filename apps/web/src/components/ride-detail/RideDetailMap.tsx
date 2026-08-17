import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Map as MapLibreMap, LngLatBounds, Marker, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus, Minus, Maximize2, Flame, ArrowLeftRight } from 'lucide-react';
import { MAP_STYLES, type MapStyleKey } from '../../utils/mapStyles';
import { adaptCoordinatesToMapStyle } from '../../utils/coordTransform';
import {
  analyzeRideTelemetry,
  computeDistanceMeters,
  findClosestTelemetryIndex,
  type PauseCluster,
} from '../../utils/telemetrySegments';

interface Props {
  ride: any;
  routeCoordinates: [number, number][];
  isReversed?: boolean;
  focusedRange?: { startProgress: number; endProgress: number } | null;
  onToggleReverse?: () => void;
  onMapReady?: (map: MapLibreMap, marker: Marker, popup: Popup) => void;
  onMapHoverPoint?: (chartIndex: number) => void;
  onMapLeavePoint?: () => void;
  onSelectMilestone?: (km: number) => void;
  onSelectPauseCluster?: (cluster: PauseCluster) => void;
}

interface StyleVisualConfig {
  glowColor?: string;
  glowWidth?: number;
  glowOpacity?: number;
  glowBlur?: number;
  casingColor: string;
  casingWidth: number;
  casingOpacity: number;
  innerWidth: number;
  milestoneClass: string;
}

const MAP_STYLE_VISUALS: Record<MapStyleKey, StyleVisualConfig> = {
  light: {
    casingColor: '#0F172A',
    casingWidth: 7,
    casingOpacity: 0.88,
    innerWidth: 4.5,
    milestoneClass: 'bg-slate-900/90 text-white border-white/90 shadow-md',
  },
  dark: {
    glowColor: '#38BDF8',
    glowWidth: 12,
    glowOpacity: 0.55,
    glowBlur: 4.0,
    casingColor: '#0284C7',
    casingWidth: 7,
    casingOpacity: 0.9,
    innerWidth: 4.5,
    milestoneClass: 'bg-slate-900/95 text-cyan-300 border-cyan-500/60 shadow-lg shadow-cyan-950/40',
  },
  satellite: {
    glowColor: '#0F172A',
    glowWidth: 9.5,
    glowOpacity: 0.65,
    glowBlur: 2.5,
    casingColor: '#FFFFFF',
    casingWidth: 7.5,
    casingOpacity: 0.98,
    innerWidth: 4.5,
    milestoneClass: 'bg-white/95 text-slate-950 border-slate-900/40 shadow-xl font-black',
  },
  terrain: {
    glowColor: '#0F172A',
    glowWidth: 11,
    glowOpacity: 0.75,
    glowBlur: 2.0,
    casingColor: '#0F172A',
    casingWidth: 8.5,
    casingOpacity: 0.98,
    innerWidth: 5.5,
    milestoneClass: 'bg-slate-900 text-white border border-white/90 shadow-xl font-bold',
  },
};

export default function RideDetailMap({
  ride,
  routeCoordinates,
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

  const [activeStyle, setActiveStyle] = useState<MapStyleKey>('light');
  const [showHeatmapLegend, setShowHeatmapLegend] = useState(true);

  // Build segmented GeoJSON with velocity colors and milestones
  const buildRouteLayers = useCallback(
    (map: MapLibreMap, styleKey: MapStyleKey) => {
      if (!routeCoordinates || routeCoordinates.length === 0) return;

      const visual = MAP_STYLE_VISUALS[styleKey] || MAP_STYLE_VISUALS.light;

      // Adapt coordinates according to base map projection (GCJ-02 for AMap, WGS-84 for OpenTopoMap/Carto)
      const adaptedCoords = adaptCoordinatesToMapStyle(routeCoordinates, styleKey);

      // Clear existing markers
      customMarkersRef.current.forEach((m) => m.remove());
      customMarkersRef.current = [];

      // Perform dynamic telemetry & pause cluster analysis
      const { pauseClusters, stats, stepDistances, telemetryPoints } = analyzeRideTelemetry(
        ride,
        routeCoordinates
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
            segmentColor = '#2563EB'; // Royal Blue (High-speed Sprint)
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
          const milestoneEl = document.createElement('div');
          milestoneEl.className =
            'relative flex items-center justify-center cursor-pointer select-none';
          milestoneEl.innerHTML = `
            <div class="px-1.5 py-0.5 rounded-full font-mono font-bold text-[9px] border flex items-center space-x-0.5 hover:scale-110 transition-transform ${visual.milestoneClass}">
              <span>${currentKmVal}</span>
              <span class="text-[7px] opacity-80">k</span>
            </div>
          `;
          milestoneEl.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelectMilestone?.(currentKmVal);
          });
          const mMarker = new Marker({ element: milestoneEl }).setLngLat(p2).addTo(map);
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
      const startCoord = adaptedCoords[0];
      const startEl = document.createElement('div');
      startEl.className = 'relative flex items-center justify-center';
      startEl.innerHTML = `
        <span class="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-emerald-400 opacity-60"></span>
        <span class="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white shadow-md"></span>
      `;
      const sMarker = new Marker({ element: startEl }).setLngLat(startCoord).addTo(map);
      customMarkersRef.current.push(sMarker);

      // Finish Marker
      if (adaptedCoords.length > 1) {
        const finishCoord = adaptedCoords[adaptedCoords.length - 1];
        const finishEl = document.createElement('div');
        finishEl.className = 'relative flex items-center justify-center -translate-y-2';
        finishEl.innerHTML = `
          <div class="bg-slate-900 text-white p-1 rounded-md shadow-md border border-white flex items-center justify-center">
            <span class="text-xs">🏁</span>
          </div>
        `;
        const fMarker = new Marker({ element: finishEl }).setLngLat(finishCoord).addTo(map);
        customMarkersRef.current.push(fMarker);
      }

      // Dynamic Pause Clusters
      pauseClusters.forEach((cluster) => {
        const targetAdaptedCoord = adaptedCoords[cluster.coordIndex] || adaptedCoords[0];

        const pauseEl = document.createElement('div');
        pauseEl.className =
          'relative flex items-center justify-center cursor-pointer group hover:scale-125 transition-transform';
        pauseEl.innerHTML = `
          <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-rose-400 opacity-75"></span>
          <div class="relative w-5 h-5 rounded-full bg-rose-600 text-white border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold">
            ⏸️
          </div>
        `;

        const pausePopup = new Popup({ offset: 12, className: 'pause-popup' }).setHTML(`
          <div style="padding: 6px 8px; max-width: 220px; font-family: sans-serif;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-weight: 800; font-size: 11px; color: #E11D48;">${cluster.title}</span>
              <span style="font-weight: 800; font-size: 10px; background: #FFE4E6; color: #9F1239; padding: 1px 5px; border-radius: 4px;">${cluster.durationMins} 分钟</span>
            </div>
            <div style="font-size: 9px; color: #64748B; margin-bottom: 4px;">
              📍 距起点 ${cluster.distanceKm} km 处 · 历时第 ${cluster.timeOffsetMins} 分
            </div>
            <p style="font-size: 10px; color: #334155; line-height: 1.4; margin: 0;">
              ${cluster.advice}
            </p>
          </div>
        `);

        pauseEl.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectPauseCluster?.(cluster);
        });

        const pMarker = new Marker({ element: pauseEl })
          .setLngLat(targetAdaptedCoord)
          .setPopup(pausePopup)
          .addTo(map);

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
      const scrubberEl = document.createElement('div');
      scrubberEl.className = 'relative flex items-center justify-center';
      scrubberEl.innerHTML = `
        <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-4 w-4 bg-blue-600 border-2 border-white shadow-lg"></span>
      `;
      const scrubberMarker = new Marker({ element: scrubberEl });
      scrubberMarkerRef.current = scrubberMarker;

      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 14,
        className: 'scrubber-popup',
      });
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
    <div className="flex-1 h-full relative bg-slate-100 overflow-hidden">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Top Floating Map Style Switcher Capsule & Direction Controls */}
      <div className="absolute top-4 left-4 z-20 flex items-center space-x-1 p-1 bg-white/90 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200/80">
        {(['light', 'dark', 'satellite', 'terrain'] as MapStyleKey[]).map((key) => {
          const item = MAP_STYLES[key];
          const isActive = activeStyle === key;
          return (
            <button
              key={key}
              onClick={() => handleStyleChange(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
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
        <div className="absolute bottom-6 left-4 z-20 bg-slate-900/90 backdrop-blur-md text-white px-3.5 py-2.5 rounded-2xl shadow-lg border border-slate-800 flex items-center space-x-3 text-[11px] font-bold">
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

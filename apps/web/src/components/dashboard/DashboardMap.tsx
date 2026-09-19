import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map as MapLibreMap, LngLatBounds, Marker } from 'maplibre-gl';
import MapFloatingControls from '../common/MapFloatingControls';
import 'maplibre-gl/dist/maplibre-gl.css';
import polyline from '@mapbox/polyline';
import { MAP_STYLES, type MapStyleKey } from '../../utils/mapStyles';
import { matchesCityFilter } from '../../utils/geoUtils';
import { adaptCoordinatesToMapStyle } from '../../utils/coordTransform';
import { MAP_ROUTE_TOKENS } from '../../constants/designTokens';
import {
  createRouteGlowLayer,
  createRouteCasingLayer,
  createRouteCoreLayer,
  createRouteHitTargetLayer,
} from '../../utils/mapRouteLayers';

interface Props {
  rides: any[];
  selectedCity: string;
  hoveredRideId: string | null;
  currentMapStyle: MapStyleKey;
}

export default function DashboardMap({
  rides,
  selectedCity,
  hoveredRideId,
  currentMapStyle,
}: Props) {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const startMarkerRef = useRef<Marker | null>(null);
  const endMarkerRef = useRef<Marker | null>(null);

  // Fit all current rides to bounds
  const fitCurrentBounds = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const targetRides =
      selectedCity === 'all'
        ? rides
        : rides.filter((r) => matchesCityFilter(r, selectedCity));

    if (targetRides.length === 0) return;

    const bounds = new LngLatBounds();
    let hasCoords = false;

    targetRides.forEach((ride) => {
      if (!ride.summary_polyline) return;
      try {
        const rawCoords = polyline.decode(ride.summary_polyline);
        const coords: [number, number][] = rawCoords.map((p) => [p[1], p[0]]);
        const adaptedCoords = adaptCoordinatesToMapStyle(coords, currentMapStyle);
        adaptedCoords.forEach((p) => {
          bounds.extend(p);
          hasCoords = true;
        });
      } catch {}
    });

    if (hasCoords) {
      map.fitBounds(bounds, { padding: 50, duration: 600 });
    }
  }, [rides, selectedCity, currentMapStyle]);

  const hasFittedInitialBoundsRef = useRef(false);
  const ridesRef = useRef(rides);
  ridesRef.current = rides;

  // Render Routes on Map
  const renderRoutes = React.useCallback((map: MapLibreMap, ridesToRender: any[], shouldFitBounds = false) => {
    if (!map || !map.isStyleLoaded() || !ridesToRender || ridesToRender.length === 0) return;

    const bounds = new LngLatBounds();
    let hasPoints = false;

    ridesToRender.forEach((ride) => {
      if (!ride.summary_polyline) return;
      try {
        const rawCoords = polyline.decode(ride.summary_polyline);
        if (!rawCoords || rawCoords.length === 0) return;

        const coords: [number, number][] = rawCoords.map((p) => [p[1], p[0]]);
        const adaptedCoords = adaptCoordinatesToMapStyle(coords, currentMapStyle);
        const sourceId = `route-${ride.id}`;

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: { rideId: ride.id, title: ride.title },
              geometry: { type: 'LineString', coordinates: adaptedCoords },
            } as any,
          });

          // Style-specific styling
          const isSat = currentMapStyle === 'satellite';

          const glowColor = isSat ? MAP_ROUTE_TOKENS.satelliteGlow : MAP_ROUTE_TOKENS.coreColor;
          const casingColor = isSat ? MAP_ROUTE_TOKENS.satelliteCasing : '#0F172A';
          const coreColor = MAP_ROUTE_TOKENS.coreColor;

          // Glow Base Layer
          if (isSat) {
            map.addLayer(
              createRouteGlowLayer({
                id: `route-glow-${ride.id}`,
                source: sourceId,
                color: glowColor,
                width: 8,
                opacity: 0.45,
                blur: 2.5,
              })
            );
          }

          // Casing Layer for Satellite to pop out
          if (isSat) {
            map.addLayer(
              createRouteCasingLayer({
                id: `route-casing-${ride.id}`,
                source: sourceId,
                color: casingColor,
                width: 6.5,
                opacity: 0.95,
              })
            );
          }

          // Sharp Core Track Line
          map.addLayer(
            createRouteCoreLayer({
              id: `route-core-${ride.id}`,
              source: sourceId,
              color: coreColor,
              width: 3.5,
              opacity: 0.95,
            })
          );

          // Transparent Hit Target Layer for direct click & hover ergonomics
          const hitLayerId = `route-hit-${ride.id}`;
          map.addLayer(
            createRouteHitTargetLayer({
              id: hitLayerId,
              source: sourceId,
              width: 22,
              opacity: 0.001,
              color: '#000000',
            })
          );

          map.on('mouseenter', hitLayerId, () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          map.on('mouseleave', hitLayerId, () => {
            map.getCanvas().style.cursor = '';
          });
          map.on('click', hitLayerId, () => {
            navigate(`/ride/${ride.id}`, { state: { from: '/' } });
          });
        }

        adaptedCoords.forEach((c) => {
          bounds.extend(c as [number, number]);
          hasPoints = true;
        });
      } catch (e) {
        console.error('Failed to draw route', e);
      }
    });

    if (hasPoints && shouldFitBounds) {
      hasFittedInitialBoundsRef.current = true;
      map.fitBounds(bounds, { padding: 45, duration: 800 });
    }
  }, [currentMapStyle, navigate]);

  // Map Initialization - 仅在底图风格变更或容器挂载时初始化一次，绝不因 rides 数据更新而销毁重做
  useEffect(() => {
    if (!mapContainer.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: MAP_STYLES[currentMapStyle]?.style || MAP_STYLES.light.style,
      center: [113.8, 22.8],
      zoom: 10,
      attributionControl: false,
    });
    mapRef.current = map;
    hasFittedInitialBoundsRef.current = false;

    map.on('load', () => {
      map.resize();
      renderRoutes(map, ridesRef.current, true);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [currentMapStyle, renderRoutes]);

  // 当 rides 数据更新且地图就绪时，增量绘制路线，不销毁重建地图，不强行动画夺取用户视野
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (map.isStyleLoaded()) {
      renderRoutes(map, rides, !hasFittedInitialBoundsRef.current);
    }
  }, [rides, renderRoutes]);

  // City Switcher Camera Focus
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const targetRides =
      selectedCity === 'all'
        ? rides
        : rides.filter((r) => matchesCityFilter(r, selectedCity));

    if (targetRides.length === 0) return;

    const bounds = new LngLatBounds();
    let hasCoords = false;

    targetRides.forEach((ride) => {
      if (!ride.summary_polyline) return;
      try {
        const rawCoords = polyline.decode(ride.summary_polyline);
        const coords: [number, number][] = rawCoords.map((p) => [p[1], p[0]]);
        const adaptedCoords = adaptCoordinatesToMapStyle(coords, currentMapStyle);
        adaptedCoords.forEach((p) => {
          bounds.extend(p);
          hasCoords = true;
        });
      } catch {}
    });

    if (hasCoords) {
      map.fitBounds(bounds, { padding: 60, duration: 700 });
    }
  }, [selectedCity, rides, currentMapStyle]);

  // Hover Highlighting of specific track
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    rides.forEach((r) => {
      const glowLayer = `route-glow-${r.id}`;
      const casingLayer = `route-casing-${r.id}`;
      const coreLayer = `route-core-${r.id}`;

      if (map.getLayer(coreLayer)) {
        if (hoveredRideId) {
          if (r.id.toString() === hoveredRideId.toString()) {
            if (map.getLayer(glowLayer)) {
              map.setPaintProperty(glowLayer, 'line-width', 14);
              map.setPaintProperty(glowLayer, 'line-opacity', 0.9);
              map.setPaintProperty(glowLayer, 'line-color', '#F59E0B');
            }
            if (map.getLayer(casingLayer)) {
              map.setPaintProperty(casingLayer, 'line-width', 8);
            }
            map.setPaintProperty(coreLayer, 'line-width', 5.5);
            map.setPaintProperty(coreLayer, 'line-color', '#D97706');

            if (r.summary_polyline) {
              try {
                const rawCoords = polyline.decode(r.summary_polyline);
                const coords: [number, number][] = rawCoords.map((p) => [p[1], p[0]]);
                const adaptedCoords = adaptCoordinatesToMapStyle(coords, currentMapStyle);

                if (adaptedCoords.length > 0) {
                  if (!startMarkerRef.current) {
                    const el = document.createElement('div');
                    el.className = 'w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-md animate-pulse';
                    startMarkerRef.current = new Marker({ element: el });
                  }
                  startMarkerRef.current.setLngLat(adaptedCoords[0]).addTo(map);

                  if (!endMarkerRef.current && coords.length > 1) {
                    const el = document.createElement('div');
                    el.className = 'w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white shadow-md animate-pulse';
                    endMarkerRef.current = new Marker({ element: el });
                  }
                  if (endMarkerRef.current && coords.length > 1) {
                    endMarkerRef.current.setLngLat(adaptedCoords[adaptedCoords.length - 1]).addTo(map);
                  }
                }
              } catch {}
            }
          } else {
            if (map.getLayer(glowLayer)) map.setPaintProperty(glowLayer, 'line-opacity', 0.05);
            if (map.getLayer(casingLayer)) map.setPaintProperty(casingLayer, 'line-opacity', 0.1);
            map.setPaintProperty(coreLayer, 'line-opacity', 0.2);
          }
        } else {
          const isSat = currentMapStyle === 'satellite';

          const glowColor = isSat ? MAP_ROUTE_TOKENS.satelliteGlow : MAP_ROUTE_TOKENS.coreColor;
          const casingColor = isSat ? MAP_ROUTE_TOKENS.satelliteCasing : '#0F172A';
          const coreColor = MAP_ROUTE_TOKENS.coreColor;

          if (map.getLayer(glowLayer)) {
            map.setPaintProperty(glowLayer, 'line-width', 8);
            map.setPaintProperty(glowLayer, 'line-opacity', 0.45);
            map.setPaintProperty(glowLayer, 'line-color', glowColor);
          }
          if (map.getLayer(casingLayer)) {
            map.setPaintProperty(casingLayer, 'line-width', 6.5);
            map.setPaintProperty(casingLayer, 'line-opacity', 0.95);
            map.setPaintProperty(casingLayer, 'line-color', casingColor);
          }
          map.setPaintProperty(coreLayer, 'line-width', 3.5);
          map.setPaintProperty(coreLayer, 'line-opacity', 0.95);
          map.setPaintProperty(coreLayer, 'line-color', coreColor);

          if (startMarkerRef.current) startMarkerRef.current.remove();
          if (endMarkerRef.current) endMarkerRef.current.remove();
        }
      }
    });
  }, [hoveredRideId, rides, currentMapStyle]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 300 });
  };

  return (
    <div className="w-full h-full relative">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Floating Zoom & Fit Controls (Bottom Right Ergonomics - iOS style integrated capsule) */}
      <MapFloatingControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitBounds={fitCurrentBounds}
        fitLabel="适应当前城市所有轨迹"
      />
    </div>
  );
}

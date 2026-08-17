import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map as MapLibreMap, LngLatBounds, Marker } from 'maplibre-gl';
import { Plus, Minus, Maximize2 } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import polyline from '@mapbox/polyline';
import { MAP_STYLES, type MapStyleKey } from '../../utils/mapStyles';
import { detectCityForRide } from '../../utils/geoUtils';
import { adaptCoordinatesToMapStyle } from '../../utils/coordTransform';

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
        : rides.filter((r) => detectCityForRide(r) === selectedCity);

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

  // Render Routes on Map
  const renderRoutes = React.useCallback((map: MapLibreMap, ridesToRender: any[]) => {
    if (!map || !map.isStyleLoaded() || ridesToRender.length === 0) return;

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
          const isDark = currentMapStyle === 'dark';
          const isSat = currentMapStyle === 'satellite';
          const isTerrain = currentMapStyle === 'terrain';

          const glowColor = isDark ? '#38BDF8' : isSat ? '#0F172A' : '#6366F1';
          const casingColor = isSat || isTerrain ? '#FFFFFF' : '#0F172A';
          const coreColor = isDark ? '#38BDF8' : isSat ? '#2563EB' : isTerrain ? '#1E1B4B' : '#4F46E5';

          // Glow Base Layer
          if (isDark || isSat) {
            map.addLayer({
              id: `route-glow-${ride.id}`,
              type: 'line',
              source: sourceId,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': glowColor,
                'line-width': isDark ? 10 : 8,
                'line-opacity': isDark ? 0.5 : 0.45,
                'line-blur': 2.5,
              },
            });
          }

          // Casing Layer for Satellite and Terrain to pop out
          if (isSat || isTerrain) {
            map.addLayer({
              id: `route-casing-${ride.id}`,
              type: 'line',
              source: sourceId,
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': casingColor,
                'line-width': 6.5,
                'line-opacity': 0.95,
              },
            });
          }

          // Sharp Core Track Line
          map.addLayer({
            id: `route-core-${ride.id}`,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': coreColor,
              'line-width': 3.5,
              'line-opacity': 0.95,
            },
          });

          // Transparent Hit Target Layer for direct click & hover ergonomics
          const hitLayerId = `route-hit-${ride.id}`;
          map.addLayer({
            id: hitLayerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-width': 22,
              'line-opacity': 0.001,
              'line-color': '#000000',
            },
          });

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

    if (hasPoints) {
      map.fitBounds(bounds, { padding: 45, duration: 800 });
    }
  }, [currentMapStyle, navigate]);

  // Map Initialization
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

    map.on('load', () => {
      map.resize();
      renderRoutes(map, rides);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [currentMapStyle, rides, renderRoutes]);

  // City Switcher Camera Focus
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const targetRides =
      selectedCity === 'all'
        ? rides
        : rides.filter((r) => detectCityForRide(r) === selectedCity);

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
          const isDark = currentMapStyle === 'dark';
          const isSat = currentMapStyle === 'satellite';
          const isTerrain = currentMapStyle === 'terrain';

          const glowColor = isDark ? '#38BDF8' : isSat ? '#0F172A' : '#6366F1';
          const casingColor = isSat || isTerrain ? '#FFFFFF' : '#0F172A';
          const coreColor = isDark ? '#38BDF8' : isSat ? '#2563EB' : isTerrain ? '#1E1B4B' : '#4F46E5';

          if (map.getLayer(glowLayer)) {
            map.setPaintProperty(glowLayer, 'line-width', isDark ? 10 : 8);
            map.setPaintProperty(glowLayer, 'line-opacity', isDark ? 0.5 : 0.45);
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

      {/* Floating Zoom & Fit Controls (Bottom Right Ergonomics) */}
      <div className="absolute right-4 bottom-6 z-20 flex flex-col space-y-1.5 pointer-events-auto">
        <button
          onClick={fitCurrentBounds}
          className="p-2.5 bg-white/90 hover:bg-white text-slate-700 rounded-xl shadow-md border border-slate-200/80 transition-all active:scale-95 cursor-pointer backdrop-blur-md"
          title="适应当前城市所有轨迹"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomIn}
          className="p-2.5 bg-white/90 hover:bg-white text-slate-700 rounded-xl shadow-md border border-slate-200/80 transition-all active:scale-95 cursor-pointer backdrop-blur-md"
          title="放大"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2.5 bg-white/90 hover:bg-white text-slate-700 rounded-xl shadow-md border border-slate-200/80 transition-all active:scale-95 cursor-pointer backdrop-blur-md"
          title="缩小"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

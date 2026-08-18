import React, { useEffect, useRef } from 'react';
import { Map as MapLibreMap, LngLatBounds, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLES } from '../../utils/mapStyles';

interface Props {
  coordinates: [number, number][];
  routeName: string;
}

export default function RouteMapPreview({ coordinates, routeName }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const startMarkerRef = useRef<Marker | null>(null);
  const endMarkerRef = useRef<Marker | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: MAP_STYLES.light.style,
      center: coordinates.length > 0 ? coordinates[0] : [113.9, 22.5],
      zoom: 12,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.resize();

      if (coordinates.length === 0) return;

      const sourceId = 'preview-route';
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        } as any,
      });

      // Glow layer
      map.addLayer({
        id: 'preview-route-glow',
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#38BDF8',
          'line-width': 8,
          'line-opacity': 0.4,
          'line-blur': 2,
        },
      });

      // Core line
      map.addLayer({
        id: 'preview-route-core',
        type: 'line',
        source: sourceId,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#0284C7',
          'line-width': 4,
          'line-opacity': 0.95,
        },
      });

      // Start Marker
      const startEl = document.createElement('div');
      startEl.className = 'w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center text-[8px] text-white font-black';
      startEl.title = '起点';
      startEl.innerText = 'S';
      startMarkerRef.current = new Marker({ element: startEl })
        .setLngLat(coordinates[0])
        .addTo(map);

      // End Marker
      if (coordinates.length > 1) {
        const endEl = document.createElement('div');
        endEl.className = 'w-4 h-4 rounded-full bg-rose-500 border-2 border-white shadow-md flex items-center justify-center text-[8px] text-white font-black';
        endEl.title = '终点';
        endEl.innerText = 'E';
        endMarkerRef.current = new Marker({ element: endEl })
          .setLngLat(coordinates[coordinates.length - 1])
          .addTo(map);
      }

      // Fit bounds
      const bounds = new LngLatBounds();
      coordinates.forEach((pt) => bounds.extend(pt));
      map.fitBounds(bounds, { padding: 40, duration: 600 });
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [coordinates]);

  return (
    <div className="w-full h-48 sm:h-64 rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative bg-slate-100">
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-200/80 text-xs font-bold text-slate-700 shadow-xs flex items-center space-x-1.5">
        <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
        <span>{routeName} · 轨迹地图</span>
      </div>
    </div>
  );
}

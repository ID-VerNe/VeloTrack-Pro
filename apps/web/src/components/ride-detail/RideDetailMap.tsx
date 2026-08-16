import React, { useEffect, useRef } from 'react';
import { Map as MapLibreMap, LngLatBounds, Marker, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Plus, Minus, Maximize2 } from 'lucide-react';
import { PASTEL_MAP_STYLE } from '../../utils/mapStyles';

interface Props {
  routeCoordinates: [number, number][];
  onMapReady?: (map: MapLibreMap, marker: Marker, popup: Popup) => void;
}

export default function RideDetailMap({ routeCoordinates, onMapReady }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const scrubberMarkerRef = useRef<Marker | null>(null);
  const scrubberPopupRef = useRef<Popup | null>(null);

  useEffect(() => {
    if (!mapContainer.current || routeCoordinates.length === 0) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const startCoord = routeCoordinates[0];
    const map = new MapLibreMap({
      container: mapContainer.current,
      style: PASTEL_MAP_STYLE,
      center: startCoord,
      zoom: 12,
      attributionControl: false,
    });
    mapRef.current = map;

    map.on('load', () => {
      map.resize();

      map.addSource('route-source', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: routeCoordinates },
        } as any,
      });

      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#1E1B4B',
          'line-width': 6.5,
          'line-opacity': 0.75,
        },
      });

      map.addLayer({
        id: 'route-inner',
        type: 'line',
        source: 'route-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#4338CA',
          'line-width': 4.5,
          'line-opacity': 1,
        },
      });

      const bounds = new LngLatBounds();
      routeCoordinates.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 60, duration: 800 });

      // Start Marker
      const startEl = document.createElement('div');
      startEl.className = 'relative flex items-center justify-center';
      startEl.innerHTML = `
        <span class="animate-ping absolute inline-flex h-7 w-7 rounded-full bg-emerald-400 opacity-60"></span>
        <span class="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white shadow-md"></span>
      `;
      new Marker({ element: startEl }).setLngLat(startCoord).addTo(map);

      // Finish Marker
      if (routeCoordinates.length > 1) {
        const finishCoord = routeCoordinates[routeCoordinates.length - 1];
        const finishEl = document.createElement('div');
        finishEl.className = 'relative flex items-center justify-center -translate-y-2';
        finishEl.innerHTML = `
          <div class="bg-slate-900 text-white p-1 rounded-md shadow-md border border-white flex items-center justify-center">
            <span class="text-xs">🏁</span>
          </div>
        `;
        new Marker({ element: finishEl }).setLngLat(finishCoord).addTo(map);
      }

      // Hover Scrubber Marker & Popup
      const scrubberEl = document.createElement('div');
      scrubberEl.className = 'relative flex items-center justify-center';
      scrubberEl.innerHTML = `
        <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-indigo-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-4 w-4 bg-indigo-600 border-2 border-white shadow-lg"></span>
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
  }, [routeCoordinates, onMapReady]);

  const handleResetBounds = () => {
    if (!mapRef.current || routeCoordinates.length === 0) return;
    const bounds = new LngLatBounds();
    routeCoordinates.forEach((c) => bounds.extend(c));
    mapRef.current.fitBounds(bounds, { padding: 60, duration: 800 });
  };

  const handleZoom = (delta: number) => {
    if (!mapRef.current) return;
    mapRef.current.setZoom(mapRef.current.getZoom() + delta);
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-slate-100 min-w-0">
      <div
        ref={mapContainer}
        className="w-full h-full"
        style={{ filter: 'contrast(95%) brightness(102%) saturate(90%)' }}
      />

      {/* Map Control Buttons */}
      <div className="absolute top-5 left-5 z-10 flex flex-col bg-white/95 backdrop-blur-md rounded-xl shadow-card border border-slate-200 overflow-hidden">
        <button
          onClick={() => handleZoom(1)}
          className="p-2 hover:bg-slate-50 text-slate-700 border-b border-slate-100 transition-colors active:scale-95 cursor-pointer"
          aria-label="放大地图"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(-1)}
          className="p-2 hover:bg-slate-50 text-slate-700 border-b border-slate-100 transition-colors active:scale-95 cursor-pointer"
          aria-label="缩小地图"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetBounds}
          className="p-2 hover:bg-slate-50 text-slate-700 transition-colors active:scale-95 cursor-pointer"
          aria-label="重置路线视角"
          title="全览整段轨迹"
        >
          <Maximize2 className="w-4 h-4 text-blue-600" />
        </button>
      </div>
    </div>
  );
}

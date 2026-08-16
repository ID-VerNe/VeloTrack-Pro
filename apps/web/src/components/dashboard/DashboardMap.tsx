import React, { useEffect, useRef } from 'react';
import { Map as MapLibreMap, LngLatBounds, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import polyline from '@mapbox/polyline';
import { MAP_STYLES } from '../../utils/mapStyles';
import { detectCityForRide } from '../../utils/geoUtils';

interface Props {
  rides: any[];
  selectedCity: string;
  hoveredRideId: string | null;
  currentMapStyle: 'light' | 'satellite';
}

export default function DashboardMap({
  rides,
  selectedCity,
  hoveredRideId,
  currentMapStyle,
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const startMarkerRef = useRef<Marker | null>(null);
  const endMarkerRef = useRef<Marker | null>(null);

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

        const coords = rawCoords.map((p) => [p[1], p[0]]);
        const sourceId = `route-${ride.id}`;

        if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: coords },
            } as any,
          });

          // Glow Base Layer
          map.addLayer({
            id: `route-glow-${ride.id}`,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': currentMapStyle === 'satellite' ? '#38BDF8' : '#6366F1',
              'line-width': 7,
              'line-opacity': 0.3,
              'line-blur': 2.5,
            },
          });

          // Sharp Core Track Line
          map.addLayer({
            id: `route-core-${ride.id}`,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': currentMapStyle === 'satellite' ? '#0284C7' : '#4F46E5',
              'line-width': 3.5,
              'line-opacity': 0.9,
            },
          });
        }

        coords.forEach((c) => {
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
  }, [currentMapStyle]);

  // Map Initialization
  useEffect(() => {
    if (!mapContainer.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new MapLibreMap({
      container: mapContainer.current,
      style: MAP_STYLES[currentMapStyle].style,
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
        const coords = polyline.decode(ride.summary_polyline).map((p) => [p[1], p[0]]);
        coords.forEach((c) => {
          bounds.extend(c as [number, number]);
          hasCoords = true;
        });
      } catch (e) {
        console.error(e);
      }
    });

    if (hasCoords) {
      map.fitBounds(bounds, {
        padding: selectedCity === 'all' ? 45 : 70,
        duration: 1000,
        maxZoom: 14,
      });
    }
  }, [selectedCity, rides]);

  // Hover Highlighting Sync
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    if (startMarkerRef.current) {
      startMarkerRef.current.remove();
      startMarkerRef.current = null;
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.remove();
      endMarkerRef.current = null;
    }

    rides.forEach((ride) => {
      const isHovered = hoveredRideId === ride.id;
      const glowId = `route-glow-${ride.id}`;
      const coreId = `route-core-${ride.id}`;

      if (map.getLayer(glowId) && map.getLayer(coreId)) {
        if (hoveredRideId) {
          if (isHovered) {
            map.setPaintProperty(glowId, 'line-color', '#06B6D4');
            map.setPaintProperty(glowId, 'line-width', 12);
            map.setPaintProperty(glowId, 'line-opacity', 0.7);

            map.setPaintProperty(coreId, 'line-color', '#0891B2');
            map.setPaintProperty(coreId, 'line-width', 5);
            map.setPaintProperty(coreId, 'line-opacity', 1);

            try {
              const coords = polyline.decode(ride.summary_polyline).map((p) => [p[1], p[0]]);
              if (coords.length > 1) {
                const startEl = document.createElement('div');
                startEl.className =
                  'w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-300/60 shadow-lg';
                startMarkerRef.current = new Marker({ element: startEl })
                  .setLngLat(coords[0] as [number, number])
                  .addTo(map);

                const endEl = document.createElement('div');
                endEl.className =
                  'w-3.5 h-3.5 rounded-full bg-indigo-600 ring-4 ring-indigo-300/60 shadow-lg';
                endMarkerRef.current = new Marker({ element: endEl })
                  .setLngLat(coords[coords.length - 1] as [number, number])
                  .addTo(map);
              }
            } catch (e) {
              console.error(e);
            }
          } else {
            map.setPaintProperty(glowId, 'line-opacity', 0.05);
            map.setPaintProperty(coreId, 'line-opacity', 0.15);
            map.setPaintProperty(coreId, 'line-color', '#94A3B8');
          }
        } else {
          const inCity = selectedCity === 'all' || detectCityForRide(ride) === selectedCity;
          map.setPaintProperty(
            glowId,
            'line-color',
            currentMapStyle === 'satellite' ? '#38BDF8' : '#6366F1'
          );
          map.setPaintProperty(glowId, 'line-width', 7);
          map.setPaintProperty(glowId, 'line-opacity', inCity ? 0.3 : 0.08);

          map.setPaintProperty(
            coreId,
            'line-color',
            inCity
              ? currentMapStyle === 'satellite'
                ? '#0284C7'
                : '#4F46E5'
              : '#94A3B8'
          );
          map.setPaintProperty(coreId, 'line-width', 3.5);
          map.setPaintProperty(coreId, 'line-opacity', inCity ? 0.9 : 0.25);
        }
      }
    });
  }, [hoveredRideId, rides, selectedCity, currentMapStyle]);

  return (
    <div
      ref={mapContainer}
      className="w-full h-full"
      style={{ filter: 'contrast(95%) brightness(102%) saturate(90%)' }}
    />
  );
}

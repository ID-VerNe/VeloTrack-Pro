import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Mountain, Bike, MapPin, Zap } from 'lucide-react';
import polyline from '@mapbox/polyline';
import { detectCityForRide } from '../utils/geoUtils';
import { calculateDualSpeeds, formatFriendlyDuration } from '../utils/cyclingCalculations';

interface Props {
  ride: any;
  isHovered?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function RideCard({ ride, isHovered, onMouseEnter, onMouseLeave }: Props) {
  const distanceKm = (ride.distance_meters / 1000).toFixed(1);
  
  const {
    movingAvgSpeedKmh,
    elapsedAvgSpeedKmh,
    movingTimeSeconds,
  } = calculateDualSpeeds(
    ride.distance_meters,
    ride.moving_time_seconds,
    ride.elapsed_time_seconds
  );

  const movingDurationStr = formatFriendlyDuration(movingTimeSeconds);

  const cityName = useMemo(() => detectCityForRide(ride), [ride]);

  const dateObj = new Date(ride.start_time);
  const dateStr = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;

  const isRoad = ride.title.includes('公路') || ride.title.toLowerCase().includes('road');

  // Calculate zero-distortion, aspect-ratio-preserved SVG path
  const { pathData, startPt, endPt } = useMemo(() => {
    if (!ride.summary_polyline) return { pathData: null, startPt: null, endPt: null };
    try {
      const coords = polyline.decode(ride.summary_polyline);
      if (!coords || coords.length === 0) return { pathData: null, startPt: null, endPt: null };

      const width = 76;
      const height = 52;
      const pad = 7;

      const midLat = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
      const cosLat = Math.cos((midLat * Math.PI) / 180);

      const projected = coords.map(([lat, lng]) => ({
        x: lng * cosLat,
        y: lat,
      }));

      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      projected.forEach((p) => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });

      const rangeX = maxX - minX || 0.0001;
      const rangeY = maxY - minY || 0.0001;

      const availW = width - 2 * pad;
      const availH = height - 2 * pad;

      const scale = Math.min(availW / rangeX, availH / rangeY);
      const drawW = rangeX * scale;
      const drawH = rangeY * scale;

      const offsetX = pad + (availW - drawW) / 2;
      const offsetY = pad + (availH - drawH) / 2;

      const points = projected.map((p) => {
        const x = offsetX + (p.x - minX) * scale;
        const y = height - (offsetY + (p.y - minY) * scale);
        return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
      });

      const d = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;
      return {
        pathData: d,
        startPt: points[0],
        endPt: points[points.length - 1],
      };
    } catch {
      return { pathData: null, startPt: null, endPt: null };
    }
  }, [ride.summary_polyline]);

  return (
    <Link
      to={`/ride/${ride.id}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`block bg-white rounded-2xl p-3.5 transition-all group relative border ${
        isHovered
          ? 'border-blue-500 shadow-md ring-2 ring-blue-500/10 scale-[1.01]'
          : 'border-slate-100 shadow-xs hover:border-blue-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className={`px-1.5 py-0.5 rounded text-xs font-extrabold tracking-wider uppercase text-white ${
            isRoad ? 'bg-blue-600' : 'bg-[#4F46E5]'
          }`}>
            {isRoad ? '公路' : '山地/骑行'}
          </span>
          <span className="px-1.5 py-0.5 rounded text-xs font-bold text-slate-500 bg-slate-100 flex items-center">
            <MapPin className="w-2.5 h-2.5 mr-0.5 text-slate-500" />
            {cityName}
          </span>
          <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-xs truncate max-w-[130px]">
            {ride.title}
          </span>
        </div>
        <span className="text-xs font-medium text-slate-500 shrink-0">{dateStr}</span>
      </div>

      <div className="flex items-center justify-between">
        {/* Metric details */}
        <div className="flex items-center space-x-3.5 text-xs">
          <div>
            <div className="font-bold text-slate-900 text-xs tabular-nums flex items-baseline">
              <span>{distanceKm}</span>
              <span className="text-xs font-normal text-slate-500 ml-0.5">公里</span>
            </div>
            <div className="text-2xs text-slate-500 font-medium truncate max-w-[70px]">
              运动 {movingDurationStr}
            </div>
          </div>

          <div>
            <div className="font-bold text-slate-900 text-xs tabular-nums flex items-center">
              <Zap className="w-2.5 h-2.5 mr-0.5 text-blue-600 shrink-0" />
              <span>{movingAvgSpeedKmh}</span>
              <span className="text-xs font-normal text-slate-500 ml-0.5">km/h</span>
            </div>
            <div className="text-2xs text-slate-500 font-medium truncate">
              总均速 {elapsedAvgSpeedKmh}
            </div>
          </div>

          <div className="flex items-center text-slate-700 font-semibold text-xs pt-0.5">
            <Mountain className="w-3 h-3 mr-1 text-slate-500" />
            <span>{ride.total_ascent_meters || 0}m</span>
          </div>
        </div>

        {/* Micro Map Preview */}
        <div className={`w-[76px] h-[52px] rounded-xl border flex items-center justify-center relative shrink-0 overflow-hidden transition-all ${
          isHovered ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-500/20' : 'bg-slate-50/90 border-slate-200/70'
        }`}>
          <div
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                'radial-gradient(#94A3B8 1px, transparent 1px), linear-gradient(0deg, rgba(226,232,240,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(226,232,240,0.5) 1px, transparent 1px)',
              backgroundSize: '8px 8px, 16px 16px, 16px 16px',
            }}
          />

          {pathData ? (
            <svg viewBox="0 0 76 52" className="w-full h-full relative z-10" aria-label="骑行路线缩略图">
              <path
                d={pathData}
                fill="none"
                stroke="rgba(79, 70, 229, 0.25)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={pathData}
                fill="none"
                stroke={isHovered ? '#0284C7' : '#4F46E5'}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {startPt && (
                <circle cx={startPt.x} cy={startPt.y} r="2.5" fill="#10B981" />
              )}
              {endPt && (
                <circle cx={endPt.x} cy={endPt.y} r="2.5" fill="#6366F1" />
              )}
            </svg>
          ) : (
            <Bike className="w-4 h-4 text-slate-300" />
          )}
        </div>
      </div>
    </Link>
  );
}

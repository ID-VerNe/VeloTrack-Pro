import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
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
      className={`block bg-white rounded-lg p-4 transition-all group relative border ${
        isHovered
          ? 'border-blue-500 bg-slate-50/50'
          : 'border-slate-200/80 hover:border-slate-300'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2 min-w-0">
          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 bg-slate-50 shrink-0">
            {isRoad ? '公路' : '山地/骑行'}
          </span>
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider shrink-0">
            {cityName}
          </span>
          <span className="h-2 w-[1px] bg-slate-200 shrink-0" />
          <span className="font-medium text-slate-900 group-hover:text-slate-600 transition-colors text-xs truncate">
            {ride.title}
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-400 shrink-0 ml-2">{dateStr}</span>
      </div>

      {/* Main Telemetry & Route Preview */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        {/* Metric details */}
        <div className="flex items-baseline space-x-4 text-xs font-mono">
          <div>
            <div className="font-semibold text-slate-900 text-sm tabular-nums flex items-baseline">
              <span>{distanceKm}</span>
              <span className="text-[10px] font-normal text-slate-400 ml-0.5 font-sans">公里</span>
            </div>
            <div className="text-[10px] text-slate-400 font-normal truncate max-w-[80px]">
              运动 {movingDurationStr}
            </div>
          </div>

          <div>
            <div className="font-semibold text-slate-900 text-sm tabular-nums flex items-baseline">
              <span>{movingAvgSpeedKmh}</span>
              <span className="text-[10px] font-normal text-slate-400 ml-0.5">km/h</span>
            </div>
            <div className="text-[10px] text-slate-400 font-normal truncate">
              总均速 {elapsedAvgSpeedKmh}
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="font-semibold text-slate-700 text-sm tabular-nums">
              <span>{ride.total_ascent_meters || 0}m</span>
            </div>
            <div className="text-[10px] text-slate-400 font-normal">
              爬升
            </div>
          </div>
        </div>

        {/* Micro Map Preview */}
        <div className={`w-[76px] h-[52px] rounded border flex items-center justify-center relative shrink-0 overflow-hidden transition-colors ${
          isHovered ? 'bg-slate-100/90 border-slate-300' : 'bg-slate-50 border-slate-200/70'
        }`}>
          {pathData ? (
            <svg viewBox="0 0 76 52" className="w-full h-full relative z-10" aria-label="骑行路线缩略图">
              <path
                d={pathData}
                fill="none"
                stroke={isHovered ? '#0F172A' : '#475569'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {startPt && (
                <circle cx={startPt.x} cy={startPt.y} r="2" fill="#10B981" />
              )}
              {endPt && (
                <circle cx={endPt.x} cy={endPt.y} r="2" fill="#64748B" />
              )}
            </svg>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

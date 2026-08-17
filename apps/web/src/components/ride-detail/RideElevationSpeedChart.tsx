import React, { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Zap, PauseCircle, Gauge, Mountain, Flame, RotateCcw } from 'lucide-react';
import { analyzeRideTelemetry, type ChartTelemetryPoint } from '../../utils/telemetrySegments';

interface Props {
  ride: any;
  routeCoordinates?: [number, number][];
  externalHoverIndex?: number | null;
  onHoverScrub?: (point: ChartTelemetryPoint) => void;
  onLeaveScrub?: () => void;
  onRangeZoom?: (range: { startIdx: number; endIdx: number; startProgress: number; endProgress: number } | null) => void;
  onJumpToPoint?: (point: ChartTelemetryPoint) => void;
}

export default function RideElevationSpeedChart({
  ride,
  routeCoordinates = [],
  externalHoverIndex,
  onHoverScrub,
  onLeaveScrub,
  onRangeZoom,
  onJumpToPoint,
}: Props) {
  const echartsInstanceRef = useRef<any>(null);
  const [isZoomed, setIsZoomed] = React.useState(false);

  const { chartData, telemetryPoints, stats, markAreas, keyPeakIndices } = useMemo(() => {
    return analyzeRideTelemetry(ride, routeCoordinates);
  }, [ride, routeCoordinates]);

  // Sync external hover index from map
  useEffect(() => {
    if (!echartsInstanceRef.current) return;
    if (externalHoverIndex !== null && externalHoverIndex !== undefined && externalHoverIndex >= 0) {
      echartsInstanceRef.current.dispatchAction({
        type: 'showTip',
        seriesIndex: 0,
        dataIndex: externalHoverIndex,
      });
      echartsInstanceRef.current.dispatchAction({
        type: 'highlight',
        seriesIndex: 0,
        dataIndex: externalHoverIndex,
      });
    } else {
      echartsInstanceRef.current.dispatchAction({
        type: 'hideTip',
      });
      echartsInstanceRef.current.dispatchAction({
        type: 'downplay',
        seriesIndex: 0,
      });
    }
  }, [externalHoverIndex]);

  const handleResetZoom = () => {
    if (!echartsInstanceRef.current) return;
    echartsInstanceRef.current.dispatchAction({
      type: 'dataZoom',
      start: 0,
      end: 100,
    });
    setIsZoomed(false);
    onRangeZoom?.(null);
  };

  const getChartOptions = () => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(15, 23, 42, 0.95)',
      borderRadius: 12,
      borderWidth: 0,
      padding: [10, 14],
      textStyle: { color: '#F8FAFC', fontSize: 11 },
      formatter: (params: any[]) => {
        const idx = params[0].dataIndex;
        const point = telemetryPoints[idx];
        const statusBadge =
          point?.status === 'paused'
            ? '<span style="color:#FDA4AF;background:#881337;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:bold;">⏸️ 停顿/等红灯</span>'
            : point?.status === 'cruising'
            ? '<span style="color:#93C5FD;background:#1E3A8A;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:bold;">⚡ 稳态高速巡航</span>'
            : point?.status === 'climbing'
            ? '<span style="color:#FDE68A;background:#78350F;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:bold;">⛰️ 起伏爬坡</span>'
            : '<span style="color:#A7F3D0;background:#064E3B;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:bold;">🚲 节奏骑行</span>';

        let html = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
            <span style="font-weight:bold;font-size:12px;font-family:monospace;">⏱️ ${params[0].name} (距起点 ${point?.distanceKm || 0} km)</span>
            ${statusBadge}
          </div>
        `;

        params.forEach((item) => {
          const isSpeed = item.seriesName.includes('速度');
          html += `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:11px;padding:2px 0;">
              <span style="color:#94A3B8;">${isSpeed ? '⚡ 瞬时速度' : '⛰️ 海拔高度'}</span>
              <span style="font-weight:bold;color:${isSpeed ? '#38BDF8' : '#34D399'};font-family:monospace;">
                ${item.value} ${isSpeed ? 'km/h' : 'm'}
              </span>
            </div>
          `;
        });
        return html;
      },
    },
    legend: {
      data: ['速度 (km/h)', '海拔高度 (m)'],
      top: 0,
      right: 0,
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 3,
      textStyle: { color: '#64748B', fontSize: 10, fontWeight: 700 },
    },
    grid: { left: 6, right: 6, bottom: 20, top: 36, containLabel: true },
    dataZoom: [
      {
        type: 'inside',
        start: 0,
        end: 100,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: true,
      },
    ],
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartData.timeLabels,
      axisLine: { lineStyle: { color: '#E2E8F0' } },
      axisLabel: { color: '#94A3B8', fontSize: 10, fontFamily: 'monospace' },
    },
    yAxis: [
      {
        name: '速度 (km/h)',
        nameTextStyle: { color: '#94A3B8', fontSize: 9 },
        type: 'value',
        scale: true,
        min: 0,
        max: (value: { max: number }) => Math.ceil(Math.max(value.max * 1.25, 20)),
        splitLine: { lineStyle: { color: '#F1F5F9' } },
        axisLabel: { color: '#2563EB', fontSize: 10, fontFamily: 'monospace' },
      },
      {
        name: '海拔 (m)',
        nameTextStyle: { color: '#94A3B8', fontSize: 9 },
        type: 'value',
        scale: true,
        min: (value: { min: number }) => Math.max(0, Math.floor(value.min * 0.85)),
        max: (value: { max: number }) => Math.ceil(Math.max(value.max * 1.25, 10)),
        splitLine: { show: false },
        axisLabel: { color: '#059669', fontSize: 10, fontFamily: 'monospace' },
      },
    ],
    series: [
      {
        name: '速度 (km/h)',
        type: 'line',
        smooth: 0.35,
        data: chartData.speedPoints,
        itemStyle: { color: '#2563EB' },
        lineStyle: { width: 2.2 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(37, 99, 235, 0.20)' },
              { offset: 1, color: 'rgba(37, 99, 235, 0.01)' },
            ],
          },
        },
        showSymbol: false,
        markArea: {
          silent: true,
          label: { show: false },
          data: markAreas,
        },
      },
      {
        name: '海拔高度 (m)',
        type: 'line',
        smooth: 0.35,
        yAxisIndex: 1,
        data: chartData.altPoints,
        itemStyle: { color: '#059669' },
        lineStyle: { width: 1.8, type: 'dashed' },
        areaStyle: { color: 'rgba(5, 150, 105, 0.05)' },
        showSymbol: false,
      },
    ],
  });

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-2xs border border-slate-200/90 space-y-4">
      {/* Header & Section Badges */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
            <Gauge className="w-3.5 h-3.5 text-slate-800" />
            <span>速度、海拔与微观路段剖面</span>
          </h3>
          <div className="flex items-center space-x-2">
            {isZoomed && (
              <button
                onClick={handleResetZoom}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center space-x-1 transition-all cursor-pointer"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>复原全貌</span>
              </button>
            )}
            <span className="text-[11px] text-slate-400 font-mono">
              总历时 {stats.elapsedMins} 分钟 · 滚轮可缩放
            </span>
          </div>
        </div>

        {/* Micro-segmentation summary badges */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center space-x-1">
            <Zap className="w-3 h-3 text-blue-600" />
            <span>踩踏做功: {stats.movingMins} min ({stats.movingRatioPct}%)</span>
          </span>

          {stats.totalPausedSecs >= 60 && (
            <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 flex items-center space-x-1">
              <PauseCircle className="w-3 h-3 text-rose-600" />
              <span>停顿等待: {stats.pausedMins} min ({stats.pausedRatioPct}%)</span>
            </span>
          )}
        </div>

        {/* Quick-Jump Key Feature Capsules */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-bold">
          <span className="text-slate-400 text-[9px] font-medium mr-0.5">特征极值快速定位:</span>
          {keyPeakIndices && (
            <>
              <button
                onClick={() => {
                  const pt = telemetryPoints[keyPeakIndices.maxSpeedPointIndex];
                  if (pt) onJumpToPoint?.(pt);
                }}
                className="px-2 py-0.5 rounded-md bg-blue-50/80 hover:bg-blue-100 text-blue-700 border border-blue-200/60 transition-all flex items-center space-x-1 cursor-pointer active:scale-95"
                title="定位至最高冲刺路段"
              >
                <Flame className="w-2.5 h-2.5 text-blue-600" />
                <span>冲刺峰值 {stats.maxSpeedKmh} km/h</span>
              </button>

              <button
                onClick={() => {
                  const pt = telemetryPoints[keyPeakIndices.maxAltPointIndex];
                  if (pt) onJumpToPoint?.(pt);
                }}
                className="px-2 py-0.5 rounded-md bg-emerald-50/80 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/60 transition-all flex items-center space-x-1 cursor-pointer active:scale-95"
                title="定位至最高海拔位置"
              >
                <Mountain className="w-2.5 h-2.5 text-emerald-600" />
                <span>爬坡顶点 {stats.maxSpeedKmh ? Math.max(10, ride?.max_altitude_meters || 37) : 0} m</span>
              </button>

              {keyPeakIndices.longestPauseCluster && (
                <button
                  onClick={() => {
                    const pc = keyPeakIndices.longestPauseCluster;
                    const pt = telemetryPoints.find((p) => p.coordIndex === pc?.coordIndex) || telemetryPoints[0];
                    if (pt) onJumpToPoint?.(pt);
                  }}
                  className="px-2 py-0.5 rounded-md bg-rose-50/80 hover:bg-rose-100 text-rose-700 border border-rose-200/60 transition-all flex items-center space-x-1 cursor-pointer active:scale-95"
                  title="定位至最长红绿灯等待点"
                >
                  <PauseCircle className="w-2.5 h-2.5 text-rose-600" />
                  <span>最长等灯 {keyPeakIndices.longestPauseCluster.durationMins} 分钟</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-56 w-full">
        <ReactECharts
          ref={(e) => {
            if (e) echartsInstanceRef.current = e.getEchartsInstance();
          }}
          notMerge={true}
          lazyUpdate={true}
          option={getChartOptions()}
          style={{ height: '100%', width: '100%' }}
          onEvents={{
            showTip: (params: any) => {
              const idx = params.dataIndex;
              if (idx !== undefined && telemetryPoints[idx]) {
                onHoverScrub?.(telemetryPoints[idx]);
              }
            },
            hideTip: () => {
              onLeaveScrub?.();
            },
            datazoom: (params: any) => {
              setIsZoomed(true);
              const start = params.start !== undefined ? params.start : (params.batch && params.batch[0]?.start) || 0;
              const end = params.end !== undefined ? params.end : (params.batch && params.batch[0]?.end) || 100;
              const total = telemetryPoints.length;
              const startIdx = Math.floor((start / 100) * total);
              const endIdx = Math.min(total - 1, Math.ceil((end / 100) * total));
              onRangeZoom?.({
                startIdx,
                endIdx,
                startProgress: start / 100,
                endProgress: end / 100,
              });
            },
          }}
        />
      </div>
    </div>
  );
}

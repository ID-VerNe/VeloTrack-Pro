import React, { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Zap, PauseCircle, Gauge, Mountain, Flame, RotateCcw } from 'lucide-react';
import { analyzeRideTelemetry, type ChartTelemetryPoint, type RideDetailPoint } from '../../utils/telemetrySegments';
import { CHART_COLORS, BRAND_COLORS } from '../../constants/designTokens';

interface Props {
  ride: any;
  routeCoordinates?: [number, number][];
  detailPoints?: RideDetailPoint[] | null;
  externalHoverIndex?: number | null;
  cruisingSpeedKmh?: number;
  onHoverScrub?: (point: ChartTelemetryPoint) => void;
  onLeaveScrub?: () => void;
  onRangeZoom?: (range: { startIdx: number; endIdx: number; startProgress: number; endProgress: number } | null) => void;
  onJumpToPoint?: (point: ChartTelemetryPoint) => void;
}

export default function RideElevationSpeedChart({
  ride,
  routeCoordinates = [],
  detailPoints = null,
  externalHoverIndex,
  cruisingSpeedKmh,
  onHoverScrub,
  onLeaveScrub,
  onRangeZoom,
  onJumpToPoint,
}: Props) {
  const echartsInstanceRef = useRef<any>(null);
  const [isZoomed, setIsZoomed] = React.useState(false);

  const { chartData, telemetryPoints, stats, markAreas, keyPeakIndices, isRealData } = useMemo(() => {
    return analyzeRideTelemetry(ride, routeCoordinates, detailPoints);
  }, [ride, routeCoordinates, detailPoints]);

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
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#334155',
      padding: [8, 12],
      textStyle: { color: '#F8FAFC', fontSize: 11, fontFamily: 'monospace' },
      formatter: (params: any[]) => {
        const idx = params[0].dataIndex;
        const point = telemetryPoints[idx];
        const statusBadge =
          point?.status === 'paused'
            ? '<span style="color:#94A3B8;border:1px solid #475569;padding:1px 5px;border-radius:3px;font-size:10px;">[停顿]</span>'
            : point?.status === 'cruising'
            ? '<span style="color:#F8FAFC;border:1px solid #64748B;padding:1px 5px;border-radius:3px;font-size:10px;">[巡航]</span>'
            : point?.status === 'climbing'
            ? '<span style="color:#CBD5E1;border:1px solid #475569;padding:1px 5px;border-radius:3px;font-size:10px;">[爬坡]</span>'
            : '<span style="color:#94A3B8;border:1px solid #334155;padding:1px 5px;border-radius:3px;font-size:10px;">[节奏]</span>';

        let html = `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;border-bottom:1px solid #334155;padding-bottom:4px;">
            <span style="font-weight:600;font-size:11px;">${params[0].name} · 距起点 ${point?.distanceKm || 0} km</span>
            ${statusBadge}
          </div>
        `;

        params.forEach((item) => {
          const isSpeed = item.seriesName.includes('速度');
          html += `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:11px;padding:2px 0;">
              <span style="color:${isSpeed ? BRAND_COLORS[400] : '#FBBF24'};">${isSpeed ? '速度' : '海拔'}</span>
              <span style="font-weight:600;color:#FFFFFF;font-family:monospace;">
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
      itemHeight: 2.5,
      textStyle: { color: '#64748B', fontSize: 10, fontFamily: 'monospace' },
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
        nameTextStyle: { color: CHART_COLORS.speed, fontSize: 9, fontFamily: 'monospace' },
        type: 'value',
        scale: true,
        min: 0,
        max: (value: { max: number }) => Math.ceil(Math.max(value.max * 1.25, 20)),
        splitLine: { lineStyle: { color: '#F8FAFC' } },
        axisLabel: { color: CHART_COLORS.speed, fontSize: 10, fontFamily: 'monospace' },
      },
      {
        name: '海拔 (m)',
        nameTextStyle: { color: '#D97706', fontSize: 9, fontFamily: 'monospace' },
        type: 'value',
        scale: true,
        min: (value: { min: number }) => {
          if (value.min < 0) {
            return Math.floor(value.min * 1.25) - 2;
          }
          return Math.floor(value.min * 0.85);
        },
        max: (value: { max: number }) => {
          if (value.max <= 0) {
            return Math.ceil(value.max * 0.75) + 5;
          }
          return Math.ceil(Math.max(value.max * 1.25, 10));
        },
        splitLine: { show: false },
        axisLabel: { color: '#D97706', fontSize: 10, fontFamily: 'monospace' },
      },
    ],
    series: [
      {
        name: '速度 (km/h)',
        type: 'line',
        smooth: 0.35,
        data: chartData.speedPoints,
        itemStyle: { color: CHART_COLORS.speed },
        lineStyle: { width: 2.2, color: CHART_COLORS.speed },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: CHART_COLORS.speedAreaTop },
              { offset: 1, color: CHART_COLORS.speedAreaBottom },
            ],
          },
        },
        showSymbol: false,
        markArea: {
          silent: true,
          label: { show: false },
          data: markAreas,
        },
        markLine: cruisingSpeedKmh && cruisingSpeedKmh > 0 ? {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: cruisingSpeedKmh,
              lineStyle: {
                color: '#10B981',
                type: 'dashed',
                width: 1.5,
              },
              label: {
                show: true,
                position: 'insideEndTop',
                formatter: `稳态巡航 ${cruisingSpeedKmh} km/h`,
                fontSize: 10,
                color: '#059669',
                fontFamily: 'monospace',
                backgroundColor: 'rgba(236, 253, 245, 0.9)',
                padding: [2, 5],
                borderRadius: 3,
                borderColor: '#A7F3D0',
                borderWidth: 1,
              },
            },
          ],
        } : undefined,
      },
      {
        name: '海拔高度 (m)',
        type: 'line',
        smooth: 0.35,
        yAxisIndex: 1,
        data: chartData.altPoints,
        itemStyle: { color: '#D97706' },
        lineStyle: { width: 1.5, type: 'dashed', color: '#D97706' },
        areaStyle: { color: 'rgba(217, 119, 6, 0.08)' },
        showSymbol: false,
      },
    ],
  });

  return (
    <div className="pt-4 space-y-6 border-t border-black/10 mt-6">
      {/* Header & Section Badges */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-medium text-black flex items-center space-x-1.5 font-sans">
            <Gauge className="w-4 h-4 text-black/64" />
            <span>速度、海拔与微观路段剖面</span>
          </h3>
          <div className="flex items-center space-x-3">
            {/* 数据源标注 */}
            {isRealData ? (
              <span
                className="text-[12px] text-black/44"
                title="海拔与速度曲线来自码表逐点实测记录"
              >
                实测逐点数据
              </span>
            ) : (
              <span
                className="text-[12px] text-black/44"
                title="此骑行无逐点明细（旧数据），海拔曲线为基于总爬升/最高海拔的示意拟合，速度为由 GPS 位移推算的估算值"
              >
                示意曲线
              </span>
            )}

            {isZoomed && (
              <button
                onClick={handleResetZoom}
                className="px-2 py-0.5 rounded text-[12px] text-black bg-black/5 hover:bg-black/10 flex items-center space-x-1 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>复原全貌</span>
              </button>
            )}
            <span className="text-[12px] text-black/44">
              总历时 {stats.elapsedMins} 分钟
            </span>
          </div>
        </div>

        {/* Micro-segmentation summary badges */}
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-black/64 pt-1">
          <span className="flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5" />
            <span>踩踏: {stats.movingMins} min ({stats.movingRatioPct}%)</span>
          </span>

          {stats.totalPausedSecs >= 60 && (
            <span className="flex items-center space-x-1.5">
              <PauseCircle className="w-3.5 h-3.5" />
              <span>停顿: {stats.pausedMins} min ({stats.pausedRatioPct}%)</span>
            </span>
          )}
        </div>

        {/* Quick-Jump Key Feature Capsules */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-[12px]">
          <span className="text-black/44 uppercase tracking-wider mr-1">特征极值:</span>
          {keyPeakIndices && (
            <>
              <button
                onClick={() => {
                  const pt = telemetryPoints[keyPeakIndices.maxSpeedPointIndex];
                  if (pt) onJumpToPoint?.(pt);
                }}
                className="px-2.5 py-1 rounded bg-black/5 hover:bg-black/10 text-black transition-colors flex items-center space-x-1.5 cursor-pointer"
                title="定位至最高冲刺路段"
              >
                <Flame className="w-3 h-3 text-black/64" />
                <span>冲刺峰值 {stats.maxSpeedKmh} km/h</span>
              </button>

              <button
                onClick={() => {
                  const pt = telemetryPoints[keyPeakIndices.maxAltPointIndex];
                  if (pt) onJumpToPoint?.(pt);
                }}
                className="px-2.5 py-1 rounded bg-black/5 hover:bg-black/10 text-black transition-colors flex items-center space-x-1.5 cursor-pointer"
                title="定位至最高海拔位置"
              >
                <Mountain className="w-3 h-3 text-black/64" />
                <span>爬坡顶点 {stats.maxSpeedKmh ? (ride?.max_altitude_meters ?? 0) : 0} m</span>
              </button>

              {keyPeakIndices.longestPauseCluster && (
                <button
                  onClick={() => {
                    const pc = keyPeakIndices.longestPauseCluster;
                    const pt = telemetryPoints.find((p) => p.coordIndex === pc?.coordIndex) || telemetryPoints[0];
                    if (pt) onJumpToPoint?.(pt);
                  }}
                  className="px-2.5 py-1 rounded bg-black/5 hover:bg-black/10 text-black transition-colors flex items-center space-x-1.5 cursor-pointer"
                  title="定位至最长红绿灯等待点"
                >
                  <PauseCircle className="w-3 h-3 text-black/64" />
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

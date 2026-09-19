import React, { useMemo, useRef, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { Zap, PauseCircle, Gauge, Mountain, Flame, RotateCcw } from 'lucide-react';
import { analyzeRideTelemetry, type ChartTelemetryPoint, type RideDetailPoint } from '../../utils/telemetrySegments';
import { buildElevationSpeedChartOptions } from '../../utils/elevationSpeedChartOptions';

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

  const getChartOptions = () =>
    buildElevationSpeedChartOptions({
      chartData,
      telemetryPoints,
      markAreas,
      cruisingSpeedKmh,
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
                className="px-2 py-0.5 rounded-md text-[12px] text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center space-x-1 transition-colors cursor-pointer border border-slate-200/60"
              >
                <RotateCcw className="w-3 h-3" />
                <span>复原全貌</span>
              </button>
            )}
            <span className="text-[12px] text-slate-400 font-mono">
              总历时 {stats.elapsedMins} 分钟
            </span>
          </div>
        </div>

        {/* Micro-segmentation summary badges */}
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-slate-600 pt-1">
          <span className="flex items-center space-x-1.5">
            <Zap className="w-3.5 h-3.5 text-brand-500" />
            <span>踩踏: {stats.movingMins} min ({stats.movingRatioPct}%)</span>
          </span>

          {stats.totalPausedSecs >= 60 && (
            <span className="flex items-center space-x-1.5">
              <PauseCircle className="w-3.5 h-3.5 text-slate-400" />
              <span>停顿: {stats.pausedMins} min ({stats.pausedRatioPct}%)</span>
            </span>
          )}
        </div>

        {/* Quick-Jump Key Feature Capsules */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-[12px]">
          <span className="text-slate-400 uppercase font-mono tracking-wider mr-1 text-[11px]">特征极值:</span>
          {keyPeakIndices && (
            <>
              <button
                onClick={() => {
                  const pt = telemetryPoints[keyPeakIndices.maxSpeedPointIndex];
                  if (pt) onJumpToPoint?.(pt);
                }}
                className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/60 transition-colors flex items-center space-x-1.5 cursor-pointer font-mono"
                title="定位至最高冲刺路段"
              >
                <Flame className="w-3 h-3 text-rose-500" />
                <span>冲刺峰值 {stats.maxSpeedKmh} km/h</span>
              </button>

              <button
                onClick={() => {
                  const pt = telemetryPoints[keyPeakIndices.maxAltPointIndex];
                  if (pt) onJumpToPoint?.(pt);
                }}
                className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/60 transition-colors flex items-center space-x-1.5 cursor-pointer font-mono"
                title="定位至最高海拔位置"
              >
                <Mountain className="w-3 h-3 text-amber-500" />
                <span>爬坡顶点 {stats.maxSpeedKmh ? (ride?.max_altitude_meters ?? 0) : 0} m</span>
              </button>

              {keyPeakIndices.longestPauseCluster && (
                <button
                  onClick={() => {
                    const pc = keyPeakIndices.longestPauseCluster;
                    const pt = telemetryPoints.find((p) => p.coordIndex === pc?.coordIndex) || telemetryPoints[0];
                    if (pt) onJumpToPoint?.(pt);
                  }}
                  className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/60 transition-colors flex items-center space-x-1.5 cursor-pointer font-mono"
                  title="定位至最长红绿灯等待点"
                >
                  <PauseCircle className="w-3 h-3 text-slate-400" />
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

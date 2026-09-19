/**
 * VeloTrack 骑行速度与海拔高度双轴图表 ECharts Option 构建工厂
 */

import { CHART_COLORS, BRAND_COLORS } from '../constants/designTokens';
import type { ChartTelemetryPoint } from './telemetrySegments';

export interface ElevationSpeedChartOptionsParams {
  chartData: {
    timeLabels: string[];
    speedPoints: number[];
    altPoints: number[];
  };
  telemetryPoints: ChartTelemetryPoint[];
  markAreas: any[];
  cruisingSpeedKmh?: number;
}

export function buildElevationSpeedChartOptions({
  chartData,
  telemetryPoints,
  markAreas,
  cruisingSpeedKmh,
}: ElevationSpeedChartOptionsParams) {
  return {
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
  };
}

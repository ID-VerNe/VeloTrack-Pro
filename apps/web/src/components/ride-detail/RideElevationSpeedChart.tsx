import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

interface Props {
  ride: any;
  onHoverScrub?: (dataIndex: number) => void;
  onLeaveScrub?: () => void;
}

export default function RideElevationSpeedChart({ ride, onHoverScrub, onLeaveScrub }: Props) {
  const chartData = useMemo(() => {
    const totalSecs = ride?.moving_time_seconds || ride?.elapsed_time_seconds || 3600;
    const numPoints = 30;
    const timeLabels: string[] = [];
    const speedPoints: number[] = [];
    const altPoints: number[] = [];

    const maxSpeed = ride?.max_speed_kmh || 35;
    const avgSpeed = ride?.avg_speed_kmh || 18;
    const maxAlt = ride?.max_altitude_meters || 45;
    const elevGain = ride?.total_ascent_meters || 100;

    for (let i = 0; i <= numPoints; i++) {
      const currentSec = Math.round((totalSecs / numPoints) * i);
      const m = Math.floor(currentSec / 60);
      const s = currentSec % 60;
      timeLabels.push(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);

      const sinVal = Math.sin((i / numPoints) * Math.PI * 3);
      const speed = Math.max(0, Math.min(maxSpeed, avgSpeed + sinVal * (maxSpeed - avgSpeed) * 0.8));
      speedPoints.push(Number(speed.toFixed(1)));

      const alt = Math.max(
        0,
        Math.round(maxAlt - elevGain * 0.4 + Math.cos((i / numPoints) * Math.PI * 2) * (elevGain * 0.35))
      );
      altPoints.push(alt);
    }

    return { timeLabels, speedPoints, altPoints, numPoints };
  }, [ride]);

  const getChartOptions = () => ({
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.95)',
      borderRadius: 10,
      borderColor: '#E2E8F0',
      textStyle: { color: '#0F172A', fontSize: 11 },
      formatter: (params: any[]) => {
        let html = `<div class="font-bold text-xs mb-1 text-slate-800">${params[0].name}</div>`;
        params.forEach((item) => {
          html += `<div class="flex items-center space-x-2 text-xs py-0.5">
            <span style="color:${item.color}">●</span>
            <span class="text-slate-500">${item.seriesName}：</span>
            <span class="font-bold text-slate-900 tabular-nums">${item.value} ${
            item.seriesName.includes('速度') ? 'km/h' : 'm'
          }</span>
          </div>`;
        });
        return html;
      },
    },
    legend: {
      data: ['速度 (km/h)', '海拔高度 (m)'],
      top: 0,
      right: 0,
      icon: 'plain',
      textStyle: { color: '#64748B', fontSize: 11 },
    },
    grid: { left: '2%', right: '2%', bottom: '8%', top: '14%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartData.timeLabels,
      axisLine: { lineStyle: { color: '#E2E8F0' } },
      axisLabel: { color: '#94A3B8', fontSize: 10 },
    },
    yAxis: [
      {
        type: 'value',
        min: 0,
        max: Math.ceil((ride?.max_speed_kmh || 35) * 1.2),
        splitLine: { lineStyle: { color: '#F1F5F9' } },
        axisLabel: { color: '#0284C7', fontSize: 10 },
      },
      {
        type: 'value',
        min: 0,
        max: Math.ceil((ride?.max_altitude_meters || 45) * 1.3) || 120,
        splitLine: { show: false },
        axisLabel: { color: '#059669', fontSize: 10 },
      },
    ],
    series: [
      {
        name: '速度 (km/h)',
        type: 'line',
        smooth: 0.35,
        data: chartData.speedPoints,
        itemStyle: { color: '#0284C7' },
        lineStyle: { width: 2 },
        areaStyle: { color: 'rgba(2, 132, 199, 0.08)' },
        showSymbol: false,
      },
      {
        name: '海拔高度 (m)',
        type: 'line',
        smooth: 0.35,
        yAxisIndex: 1,
        data: chartData.altPoints,
        itemStyle: { color: '#059669' },
        lineStyle: { width: 2 },
        areaStyle: { color: 'rgba(5, 150, 105, 0.08)' },
        showSymbol: false,
      },
    ],
  });

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100/80">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          速度与海拔剖面图
        </h3>
        <span className="text-[11px] text-slate-400 font-medium">
          鼠标滑动折线图可在地图同步定位瞬时点
        </span>
      </div>

      <div className="h-44 w-full">
        <ReactECharts
          option={getChartOptions()}
          style={{ height: '100%', width: '100%' }}
          onEvents={{
            mouseover: (params: any) => {
              const dataIndex =
                params.dataIndex ?? (params.seriesIndex !== undefined ? params.dataIndex : 0);
              if (onHoverScrub && dataIndex !== undefined) {
                onHoverScrub(dataIndex);
              }
            },
            mouseout: () => {
              if (onLeaveScrub) onLeaveScrub();
            },
          }}
        />
      </div>
    </div>
  );
}

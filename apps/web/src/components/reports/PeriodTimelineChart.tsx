import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';

interface Props {
  timeline: {
    labels: string[];
    distance: number[];
    ascent: number[];
  };
}

export default function PeriodTimelineChart({ timeline }: Props) {
  const chartOption = useMemo(() => {
    if (!timeline) return {};
    const { labels, distance, ascent } = timeline;

    return {
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
              item.seriesName.includes('里程') ? 'km' : 'm'
            }</span>
            </div>`;
          });
          return html;
        },
      },
      legend: {
        data: ['里程 (km)', '爬升 (m)'],
        top: 0,
        right: 0,
        icon: 'circle',
        textStyle: { color: '#64748B', fontSize: 11 },
      },
      grid: { left: '2%', right: '2%', bottom: '8%', top: '14%', containLabel: true },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: '#E2E8F0' } },
        axisLabel: { color: '#64748B', fontSize: 11, fontWeight: 'bold' },
      },
      yAxis: [
        {
          type: 'value',
          name: 'km',
          splitLine: { lineStyle: { color: '#F1F5F9' } },
          axisLabel: { color: '#2563EB', fontSize: 10 },
        },
        {
          type: 'value',
          name: 'm',
          splitLine: { show: false },
          axisLabel: { color: '#059669', fontSize: 10 },
        },
      ],
      series: [
        {
          name: '里程 (km)',
          type: 'bar',
          barMaxWidth: 28,
          itemStyle: {
            color: '#2563EB',
            borderRadius: [6, 6, 0, 0],
          },
          data: distance,
        },
        {
          name: '爬升 (m)',
          type: 'line',
          smooth: true,
          yAxisIndex: 1,
          itemStyle: { color: '#059669' },
          lineStyle: { width: 3 },
          data: ascent,
        },
      ],
    };
  }, [timeline]);

  return (
    <div className="bg-slate-50/60 rounded-3xl p-6 border border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          周期内里程与爬升走势拆解
        </h3>
        <span className="text-xs text-slate-500 font-medium">按时间细分统计</span>
      </div>

      <div className="h-56 w-full">
        <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}

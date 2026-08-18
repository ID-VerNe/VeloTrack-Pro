// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

let currentChartOption: any = null;

// Mock echarts-for-react：保留完整 option 配置对象
vi.mock('echarts-for-react', () => ({
  default: (props: any) => {
    currentChartOption = props.option;
    return <div data-testid="chart" />;
  },
}));

import RideElevationSpeedChart from '../ride-detail/RideElevationSpeedChart';

/**
 * RideElevationSpeedChart 速度/海拔剖面图测试
 * 覆盖：option 中双 series（速度/海拔）数量、命名、数据与 xAxis 对齐、
 * 遥测统计文案、空坐标默认降级渲染。
 */

const baseRide = {
  id: 1,
  title: '测试骑行',
  elapsed_time_seconds: 5400, // 90 分钟
  moving_time_seconds: 5400,
  distance_meters: 20000,
  max_speed_kmh: 35,
};

const coords: [number, number][] = [
  [113.8, 22.5],
  [113.81, 22.51],
  [113.82, 22.52],
];

/** 读取 mock 图表接收到的 option */
function getOption(): any {
  return currentChartOption;
}

describe('RideElevationSpeedChart', () => {
  it('生成速度与海拔双 series，数据与 xAxis 标签对齐', () => {
    render(<RideElevationSpeedChart ride={baseRide} routeCoordinates={coords} />);
    const option = getOption();

    expect(option.series).toHaveLength(2);
    expect(option.series[0].name).toBe('速度 (km/h)');
    expect(option.series[1].name).toBe('海拔高度 (m)');
    expect(option.series[0].type).toBe('line');
    expect(option.series[1].type).toBe('line');

    expect(option.xAxis.data).toHaveLength(option.series[0].data.length);
    // 3 个坐标点 -> 自适应 30 个图表采样点
    expect(option.series[0].data).toHaveLength(30);
    expect(option.series[0].data.every((v: any) => typeof v === 'number')).toBe(true);
    expect(option.series[1].data.every((v: any) => typeof v === 'number')).toBe(true);
  });

  it('legend 包含两个系列名', () => {
    render(<RideElevationSpeedChart ride={baseRide} routeCoordinates={coords} />);
    const option = getOption();
    expect(option.legend.data).toEqual(['速度 (km/h)', '海拔高度 (m)']);
  });

  it('渲染遥测统计文案（总历时/踩踏做功/峰值速度）', () => {
    render(<RideElevationSpeedChart ride={baseRide} routeCoordinates={coords} />);
    expect(screen.getByText(/总历时 90 分钟/)).toBeInTheDocument();
    expect(screen.getByText(/踩踏做功: 90 min \(100%\)/)).toBeInTheDocument();
    expect(screen.getByText(/冲刺峰值 35 km\/h/)).toBeInTheDocument();
  });

  it('routeCoordinates 为空时降级渲染（45 个默认采样点）', () => {
    render(<RideElevationSpeedChart ride={baseRide} />);
    const option = getOption();
    expect(option.series).toHaveLength(2);
    expect(option.series[0].data).toHaveLength(45);
    expect(option.xAxis.data).toHaveLength(45);
  });

  it('有停顿记录时显示停顿等待徽标', () => {
    const pausedRide = { ...baseRide, moving_time_seconds: 4800, elapsed_time_seconds: 5400 };
    render(<RideElevationSpeedChart ride={pausedRide} routeCoordinates={coords} />);
    expect(screen.getByText(/停顿等待: 10 min \(11%\)/)).toBeInTheDocument();
  });

  it('支持负数海拔正常绘制且 Y 轴下限支持负值', () => {
    const detailPointsWithNegativeAlt = [
      { t: 1000, sp: 20, al: -10, la: 22.5, ln: 113.8 },
      { t: 2000, sp: 22, al: -5, la: 22.51, ln: 113.81 },
      { t: 3000, sp: 25, al: 5, la: 22.52, ln: 113.82 },
    ];
    render(
      <RideElevationSpeedChart
        ride={baseRide}
        routeCoordinates={coords}
        detailPoints={detailPointsWithNegativeAlt}
      />
    );
    const option = getOption();
    const altMinFn = option.yAxis[1].min;
    expect(typeof altMinFn).toBe('function');
    expect(altMinFn({ min: -10 })).toBeLessThan(-10);
    expect(option.series[1].data).toContain(-10);
    expect(option.series[1].data).toContain(-5);
  });
});

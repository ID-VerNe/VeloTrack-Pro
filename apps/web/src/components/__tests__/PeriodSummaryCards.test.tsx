// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PeriodSummaryCards from '../reports/PeriodSummaryCards';

/**
 * PeriodSummaryCards 周期汇总卡片测试
 * 覆盖：null 边界、四大指标渲染、涨跌变化徽章分支、停顿文案分支
 */

const summary = {
  total_distance_km: 120,
  prev_distance_km: 90,
  rides_count: 3,
  moving_time_seconds: 7200,
  paused_time_seconds: 300,
  moving_ratio_pct: 92,
  distance_change_pct: 33,
  avg_speed_change_pct: -5,
  moving_avg_speed_kmh: 25,
  elapsed_avg_speed_kmh: 22,
  max_speed_kmh: 55,
  calories: 1500,
  total_ascent_meters: 600,
  prev_ascent_meters: 400,
};

describe('PeriodSummaryCards', () => {
  it('summary 为 null 时不渲染', () => {
    const { container } = render(<PeriodSummaryCards summary={null as any} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('渲染总里程、做功时间、均速、爬升与卡路里', () => {
    render(<PeriodSummaryCards summary={summary} />);
    expect(screen.getByText('周期总里程')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText(/上周期: 90 km · 完成 3 次/)).toBeInTheDocument();
    expect(screen.getByText('2:00:00')).toBeInTheDocument(); // 7200s
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('600')).toBeInTheDocument();
    expect(screen.getByText('1500 kcal')).toBeInTheDocument();
    expect(screen.getByText(/总均速: 22 km\/h/)).toBeInTheDocument();
    expect(screen.getByText(/极速: 55 km\/h/)).toBeInTheDocument();
  });

  it('正增长显示 emerald 徽章，负增长显示 rose 徽章', () => {
    const { container } = render(<PeriodSummaryCards summary={summary} />);
    expect(screen.getByText('33%')).toBeInTheDocument();
    expect(screen.getByText('5%')).toBeInTheDocument(); // 取绝对值
    expect(container.querySelectorAll('.text-emerald-700').length).toBe(1);
    expect(container.querySelectorAll('.text-rose-600').length).toBe(1);
  });

  it('change 为 0 时不显示变化徽章', () => {
    const zero = { ...summary, distance_change_pct: 0, avg_speed_change_pct: 0 };
    render(<PeriodSummaryCards summary={zero} />);
    expect(screen.queryByText('33%')).not.toBeInTheDocument();
    expect(screen.queryByText('5%')).not.toBeInTheDocument();
  });

  it('有停顿显示分钟数，无停顿显示「无明显停顿延误」', () => {
    render(<PeriodSummaryCards summary={summary} />);
    expect(screen.getByText(/红绿灯\/停顿耗时: 5 分钟/)).toBeInTheDocument();

    const noPause = { ...summary, paused_time_seconds: 0 };
    render(<PeriodSummaryCards summary={noPause} />);
    expect(screen.getByText('无明显停顿延误')).toBeInTheDocument();
  });
});

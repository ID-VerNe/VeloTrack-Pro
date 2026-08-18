// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import TotalStatsCard from '../TotalStatsCard';

/**
 * TotalStatsCard 累计总览卡测试
 * 覆盖：空数据边界、里程/时长/均速聚合、次数统计、千分位格式
 */

const rides = [
  { distance_meters: 40000, moving_time_seconds: 3600, elapsed_time_seconds: 4200 },
  { distance_meters: 20000, moving_time_seconds: 1800, elapsed_time_seconds: 2000 },
];

describe('TotalStatsCard', () => {
  it('渲染总里程、总时长、总次数与均速', () => {
    render(<TotalStatsCard rides={rides} />);
    expect(screen.getByText('累计遥测总里程')).toBeInTheDocument();
    expect(screen.getByText('60.0')).toBeInTheDocument(); // 60 km
    expect(screen.getByText('公里')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 次
    expect(screen.getByText('1.5')).toBeInTheDocument(); // 1.5 小时
    expect(screen.getByText(/停表均速 40 km\/h/)).toBeInTheDocument();
  });

  it('空数组渲染 0 值且不报错', () => {
    render(<TotalStatsCard rides={[]} />);
    expect(screen.getByText('0.0')).toBeInTheDocument();
    // 0 次/0 停表均速/0 总均速等多个 0 值
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
  });

  it('里程 ≥1000 时使用千分位整数格式', () => {
    const bigRides = [
      { distance_meters: 1_200_000, moving_time_seconds: 7200, elapsed_time_seconds: 7200 },
    ];
    render(<TotalStatsCard rides={bigRides} />);
    expect(screen.getByText('1,200')).toBeInTheDocument();
  });
});

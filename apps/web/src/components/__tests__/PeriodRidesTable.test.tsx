// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import PeriodRidesTable from '../reports/PeriodRidesTable';

/**
 * PeriodRidesTable 周期骑行表格测试
 * 覆盖：空数据空态、骑行卡片渲染（标题/里程/时长/速度）、Link 跳转
 */

const rides = [
  {
    id: 'r1',
    title: '晨间刷圈',
    start_time: new Date(2026, 6, 5).getTime(),
    distance_km: 42.5,
    moving_time_seconds: 5400,
    avg_speed_kmh: 28,
    max_speed_kmh: 50,
    total_ascent_meters: 300,
  },
  {
    id: 'r2',
    title: '午间休闲骑',
    start_time: new Date(2026, 6, 6).getTime(),
    distance_km: 18,
    duration_seconds: 3600,
    moving_avg_speed_kmh: 18,
    elapsed_avg_speed_kmh: 15,
    avg_speed_kmh: 16,
    max_speed_kmh: 40,
    total_ascent_meters: 100,
  },
];

function renderTable(list: any[]) {
  return render(
    <MemoryRouter>
      <PeriodRidesTable rides={list} />
    </MemoryRouter>
  );
}

describe('PeriodRidesTable', () => {
  it('空数据渲染空态提示', () => {
    renderTable([]);
    expect(screen.getByText('该周期内暂无骑行记录')).toBeInTheDocument();
    expect(screen.getByText('本周期骑行记录 (0)')).toBeInTheDocument();
  });

  it('渲染骑行卡片的标题、里程、时长与均速', () => {
    renderTable(rides);
    expect(screen.getByText('晨间刷圈')).toBeInTheDocument();
    expect(screen.getByText('42.5 km')).toBeInTheDocument();
    expect(screen.getByText('1:30:00')).toBeInTheDocument(); // 5400s
    expect(screen.getByText('28')).toBeInTheDocument();
    expect(screen.getByText('本周期骑行记录 (2)')).toBeInTheDocument();
  });

  it('elapsed 均速与 moving 均速不同时显示总均速', () => {
    renderTable(rides);
    expect(screen.getByText('总均速 15')).toBeInTheDocument();
  });

  it('链接指向 /ride/{id}', () => {
    renderTable(rides);
    const link = screen.getByRole('link', { name: /晨间刷圈/ });
    expect(link).toHaveAttribute('href', '/ride/r1');
  });
});

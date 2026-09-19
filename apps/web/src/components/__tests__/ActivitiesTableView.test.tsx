import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActivitiesTableView from '../activities/ActivitiesTableView';

describe('ActivitiesTableView 结构化骑行表格', () => {
  const mockRides = [
    {
      id: 'ride-1',
      title: '深圳湾晨骑',
      city: '深圳',
      start_time: new Date('2026-05-20T08:00:00Z').getTime(),
      distance_meters: 35200,
      moving_time_seconds: 4500,
      avg_speed_kmh: 28.2,
      total_ascent_meters: 150,
    },
  ];

  it('正确渲染表头与骑行数据行指标', () => {
    const onRideClick = vi.fn();
    const onDeleteRequest = vi.fn();

    render(
      <ActivitiesTableView
        rides={mockRides}
        onRideClick={onRideClick}
        onDeleteRequest={onDeleteRequest}
      />
    );

    expect(screen.getByText('骑行名称与日期')).toBeInTheDocument();
    expect(screen.getByText('深圳湾晨骑')).toBeInTheDocument();
    expect(screen.getByText('深圳')).toBeInTheDocument();
    expect(screen.getByText('35.2')).toBeInTheDocument();
    expect(screen.getByText('28.2')).toBeInTheDocument();
  });

  it('点击骑行行触发 onRideClick，点击删除触发 onDeleteRequest', () => {
    const onRideClick = vi.fn();
    const onDeleteRequest = vi.fn();

    render(
      <ActivitiesTableView
        rides={mockRides}
        onRideClick={onRideClick}
        onDeleteRequest={onDeleteRequest}
      />
    );

    fireEvent.click(screen.getByTestId('activity-row-ride-1'));
    expect(onRideClick).toHaveBeenCalledWith('ride-1');

    const deleteBtn = screen.getByLabelText('删除此记录');
    fireEvent.click(deleteBtn);
    expect(onDeleteRequest).toHaveBeenCalledWith(expect.anything(), 'ride-1', '深圳湾晨骑');
  });
});

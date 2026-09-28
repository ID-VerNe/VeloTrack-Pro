// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { MapStyleProvider } from '../../contexts/MapStyleContext';
import { useApi } from '../../hooks/useApi';
import { getRiderProfile } from '../../services/riderService';

vi.mock('../../hooks/useApi', () => ({
  useApi: vi.fn(),
}));

vi.mock('../../services/riderService', () => ({
  getRiderProfile: vi.fn(),
}));

vi.mock('../../components/dashboard/DashboardMap', () => ({
  default: () => <div data-testid="dashboard-map" />,
}));

const mockRides = [
  {
    id: 'ride-sz-1',
    title: '深圳湾夜骑',
    start_time: new Date('2026-05-18T20:00:00').getTime(),
    distance_meters: 25000,
    moving_time_seconds: 3600,
    elapsed_time_seconds: 3800,
    city: '深圳',
    start_point: [113.95, 22.53],
  },
  {
    id: 'ride-sz-2',
    title: '大山陂水库晨练',
    start_time: new Date('2026-05-19T07:00:00').getTime(),
    distance_meters: 15000,
    moving_time_seconds: 2400,
    elapsed_time_seconds: 2600,
    city: '深圳',
    start_point: [114.20, 22.65],
  },
  {
    id: 'ride-gz-1',
    title: '广州大学城外环',
    start_time: new Date('2026-05-20T09:00:00').getTime(),
    distance_meters: 30000,
    moving_time_seconds: 4000,
    elapsed_time_seconds: 4200,
    city: '广州',
    start_point: [113.38, 23.05],
  },
];

describe('Dashboard 仪表盘页面与城市筛选联动测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRiderProfile).mockResolvedValue({
      name: 'VerNe',
      target_cadence: '85-95',
      ftp: 220,
    } as any);

    vi.mocked(useApi).mockReturnValue({
      data: mockRides,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  const renderDashboard = () =>
    render(
      <MemoryRouter>
        <MapStyleProvider>
          <Dashboard />
        </MapStyleProvider>
      </MemoryRouter>
    );

  it('初始状态展示全量数据（3 次骑行、70.0 公里）', () => {
    renderDashboard();

    // 顶部问候栏
    expect(screen.getByText(/已记录 3 次骑行/)).toBeInTheDocument();
    // 统计卡片全量里程: 25 + 15 + 30 = 70.0 km
    expect(screen.getByText('70.0')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(2);
    // 列表显示全部骑行记录 (3)
    expect(screen.getByText(/全部骑行记录 \(3\)/)).toBeInTheDocument();
  });

  it('切换城市筛选至深圳后，总计里程、打卡日历和计数动态联动', async () => {
    const user = userEvent.setup();
    renderDashboard();

    // 找到城市选择器中的“深圳”按钮并点击
    const szBtn = screen.getByRole('button', { name: /深圳/ });
    expect(szBtn).toBeInTheDocument();
    await user.click(szBtn);

    // 1. 顶部问候副标题应联动为已筛选 2 次骑行（共 3 次）
    expect(screen.getByText(/已筛选 2 次骑行（共 3 次）/)).toBeInTheDocument();

    // 2. TotalStatsCard 聚合里程更新为深圳专属：25 + 15 = 40.0 km
    expect(screen.getByText('40.0')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText('70.0')).not.toBeInTheDocument();

    // 3. 统计卡片与打卡日历呈现深圳筛选徽标
    const badges = screen.getAllByText('深圳');
    expect(badges.length).toBeGreaterThanOrEqual(2);

    // 4. 下方活动列表更新为深圳记录 (2)
    expect(screen.getByText(/深圳 骑行记录 \(2\)/)).toBeInTheDocument();
    expect(screen.getByText('深圳湾夜骑')).toBeInTheDocument();
    expect(screen.getByText('大山陂水库晨练')).toBeInTheDocument();
    expect(screen.queryByText('广州大学城外环')).not.toBeInTheDocument();
  });

  it('切换回全部城市后恢复全量统计', async () => {
    const user = userEvent.setup();
    renderDashboard();

    // 先切到深圳
    const szBtn = screen.getByRole('button', { name: /深圳/ });
    await user.click(szBtn);
    expect(screen.getByText('40.0')).toBeInTheDocument();

    // 再切回全部
    const allBtn = screen.getByRole('button', { name: /全部/ });
    await user.click(allBtn);

    expect(screen.getByText(/已记录 3 次骑行/)).toBeInTheDocument();
    expect(screen.getByText('70.0')).toBeInTheDocument();
    expect(screen.getByText(/全部骑行记录 \(3\)/)).toBeInTheDocument();
  });
});

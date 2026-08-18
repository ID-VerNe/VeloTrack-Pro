// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RideDetail from '../RideDetail';

// Mock subcomponents that rely on WebGL / ECharts / MapLibre to keep tests fast and deterministic
vi.mock('../../components/ride-detail/RideDetailMap', () => ({
  default: () => <div data-testid="mock-ride-detail-map" />,
}));
vi.mock('../../components/ride-detail/RideElevationSpeedChart', () => ({
  default: () => <div data-testid="mock-elevation-speed-chart" />,
}));

const mockRide = {
  id: 'ride-001',
  title: '南山大南山夜骑',
  start_time: 1700000000000,
  end_time: 1700003600000,
  distance_meters: 18000,
  avg_speed_kmh: 24.5,
  max_speed_kmh: 48.2,
  total_ascent_meters: 320,
  moving_time_seconds: 3200,
  elapsed_time_seconds: 3600,
  avg_heart_rate: 145,
  max_heart_rate: 172,
  start_lat: 22.5,
  start_lng: 113.9,
  summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
};

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('RideDetail 骑行详情页面', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();

    global.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/rides/ride-001') {
        if (init?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, id: 'ride-001' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ride: mockRide, detailPoints: [] }),
        });
      }
      if (url === '/api/rider/profile') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ profile: { nickname: '车手' } }),
        });
      }
      if (url.startsWith('/api/ai/insights')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ insight: '训练表现优秀' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;
  });

  it('成功加载并渲染详情页标题与指标', async () => {
    render(
      <MemoryRouter initialEntries={['/ride/ride-001']}>
        <Routes>
          <Route path="/ride/:id" element={<RideDetail />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('南山大南山夜骑')).toBeInTheDocument();
    expect(screen.getByText('18.00')).toBeInTheDocument(); // 距离 km
  });

  it('点击删除按钮触发二次确认并在确认后发起 DELETE 请求并跳转回来源路径', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[{ pathname: '/ride/ride-001', state: { from: '/rides' } }]}>
        <Routes>
          <Route path="/ride/:id" element={<RideDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('南山大南山夜骑');

    // 点击删除按钮
    const deleteBtn = screen.getByTitle('删除此条骑行记录');
    await user.click(deleteBtn);

    // 确认横幅出现
    expect(screen.getByText(/确定要删除此骑行记录吗？此操作无法撤销。/)).toBeInTheDocument();

    // 点击确认删除
    const confirmBtn = screen.getByRole('button', { name: '确认删除' });
    await user.click(confirmBtn);

    // 验证 DELETE 请求触发
    expect(global.fetch).toHaveBeenCalledWith('/api/rides/ride-001', { method: 'DELETE' });

    // 验证路由返回跳转至 /rides
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/rides', { replace: true });
    });
  });

  it('从仪表盘进入时删除跳转回首页 /', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/ride/ride-001']}>
        <Routes>
          <Route path="/ride/:id" element={<RideDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('南山大南山夜骑');

    const deleteBtn = screen.getByTitle('删除此条骑行记录');
    await user.click(deleteBtn);

    const confirmBtn = screen.getByRole('button', { name: '确认删除' });
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });
});

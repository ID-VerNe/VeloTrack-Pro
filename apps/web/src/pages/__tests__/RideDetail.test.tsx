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

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
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

  it('未配置管理令牌时点击删除阻止发送 DELETE 请求并弹窗警告', async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    localStorage.removeItem('velotrack_admin_token');

    render(
      <MemoryRouter initialEntries={[{ pathname: '/ride/ride-001', state: { from: '/rides' } }]}>
        <Routes>
          <Route path="/ride/:id" element={<RideDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('南山大南山夜骑');

    const deleteBtn = screen.getByTitle('删除此条骑行记录');
    await user.click(deleteBtn);

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('未检测到管理令牌'));
    expect(screen.queryByText(/确定要删除此骑行记录吗/)).not.toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalledWith('/api/rides/ride-001', expect.objectContaining({ method: 'DELETE' }));

    alertSpy.mockRestore();
  });

  it('已配置管理令牌时点击删除触发二次确认并在确认后发起携带 Bearer Token 的 DELETE 请求并跳转回来源路径', async () => {
    const user = userEvent.setup();
    localStorage.setItem('velotrack_admin_token', 'test_admin_token_123');

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

    // 验证 DELETE 请求触发且携带 Authorization 与 X-Admin-Token
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/rides/ride-001', {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer test_admin_token_123',
        'X-Admin-Token': 'test_admin_token_123',
      },
    });

    // 验证路由返回跳转至 /rides
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/rides', { replace: true });
    });

    localStorage.removeItem('velotrack_admin_token');
  });

  it('从仪表盘进入时删除跳转回首页 /', async () => {
    const user = userEvent.setup();
    localStorage.setItem('velotrack_admin_token', 'test_admin_token_123');

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

    localStorage.removeItem('velotrack_admin_token');
  });

  it('点击规范路段命名直接应用新标题并支持一键撤销', async () => {
    const user = userEvent.setup();

    // 增强 mock：用 Services 端点（getAIConfig/getRiderProfile/suggestRideTitle/insight 缓存）
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      // 前端 aiClient.getAIConfig 读 /api/ai/config
      if (url === '/api/ai/config') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ config: { base_url: '', model_name: 'glm-5.2' } }),
        });
      }
      // 前端 riderService.getRiderProfile 读 /api/ai/rider/profile
      if (url === '/api/ai/rider/profile') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ profile: { nickname: '车手', weight_kg: 75 } }),
        });
      }
      // 前端 aiInsights.getRideInsight 读缓存 /api/ai/rides/:id/insight（GET）
      if (url === '/api/ai/rides/ride-001/insight' && (!init || init.method === undefined || init.method === 'GET')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ cached: false, insight: '' }),
        });
      }
      // 前端 aiInsights 调 Gateway 失败时写缓存 POST：吞掉即可
      if (url === '/api/ai/rides/ride-001/insight' && init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      }
      // 前端 riderService.getRiderContextPrompt 拉全量 rides 做聚合
      if (url === '/api/rides') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rides: [] }),
        });
      }
      if (url === '/api/rides/ride-001') {
        if (init?.method === 'PATCH') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, title: '周一短途巡航' }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ride: { ...mockRide }, detailPoints: [] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
    globalThis.fetch = fetchMock as any;

    render(
      <MemoryRouter initialEntries={['/ride/ride-001']}>
        <Routes>
          <Route path="/ride/:id" element={<RideDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('南山大南山夜骑');

    // 点击「规范路段命名」
    const polishBtn = screen.getByText('规范路段命名');
    await user.click(polishBtn);

    // AI base_url 未配置时 suggestRideTitle 走规则兜底命名，PATCH 仍应应用兜底标题
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/rides/ride-001',
        expect.objectContaining({
          method: 'PATCH',
        })
      );
    });

    // 撤销横幅出现，点击撤销恢复原标题
    const undoBtn = await screen.findByRole('button', { name: '撤销' });
    await user.click(undoBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/rides/ride-001',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ title: '南山大南山夜骑' }),
        })
      );
    });
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('南山大南山夜骑');
  });
});


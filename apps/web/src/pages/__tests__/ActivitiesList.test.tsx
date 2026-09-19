// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ActivitiesList from '../ActivitiesList';

const mockRides = [
  {
    id: 'ride-001',
    title: '深圳湾晨间巡航',
    start_time: 1700000000000,
    distance_meters: 25000,
    avg_speed_kmh: 28.5,
    total_ascent_meters: 150,
    moving_time_seconds: 3600,
    elapsed_time_seconds: 3700,
    start_lat: 22.5,
    start_lng: 113.9,
  },
  {
    id: 'ride-002',
    title: '梧桐山爬坡训练',
    start_time: 1700086400000,
    distance_meters: 42000,
    avg_speed_kmh: 21.2,
    total_ascent_meters: 850,
    moving_time_seconds: 7200,
    elapsed_time_seconds: 7500,
    start_lat: 22.55,
    start_lng: 114.1,
  },
];

describe('ActivitiesList 骑行列表页面', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('velotrack_admin_token', 'test_admin_token_123');
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/rides') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rides: [...mockRides] }),
        });
      }
      if (url === '/api/rider/profile') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ profile: { nickname: '车手' } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    }) as any;
  });

  it('正确加载并渲染骑行记录列表', async () => {
    render(
      <MemoryRouter>
        <ActivitiesList />
      </MemoryRouter>
    );

    expect(await screen.findByText('深圳湾晨间巡航')).toBeInTheDocument();
    expect(screen.getByText('梧桐山爬坡训练')).toBeInTheDocument();
    expect(screen.getByText(/共记录 2 次骑行/)).toBeInTheDocument();
  });

  it('支持搜索过滤', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ActivitiesList />
      </MemoryRouter>
    );

    await screen.findByText('深圳湾晨间巡航');
    const searchInput = screen.getByPlaceholderText('搜索骑行名称...');
    await user.type(searchInput, '梧桐山');

    expect(screen.queryByText('深圳湾晨间巡航')).not.toBeInTheDocument();
    expect(screen.getByText('梧桐山爬坡训练')).toBeInTheDocument();
  });

  it('在表格模式下点击删除图标并在确认后执行删除', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const deleteFetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/rides/ride-002' && init?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, id: 'ride-002' }),
        });
      }
      if (url === '/api/rides') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rides: [...mockRides] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
    globalThis.fetch = deleteFetchMock as any;

    render(
      <MemoryRouter>
        <ActivitiesList />
      </MemoryRouter>
    );

    await screen.findByText('深圳湾晨间巡航');

    // 切换到表格视图
    await user.click(screen.getByLabelText('紧凑表格视图'));

    // 列表中按最新日期排序：ride-002（梧桐山）排在第一项
    const deleteButtons = screen.getAllByLabelText('删除此记录');
    expect(deleteButtons.length).toBe(2);

    await user.click(deleteButtons[0]);

    // 验证 confirm 调用与 DELETE 请求触发
    expect(screen.getByText('删除骑行记录')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '删除记录' }));

    await waitFor(() => {
      expect(deleteFetchMock).toHaveBeenCalledWith('/api/rides/ride-002', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer test_admin_token_123',
          'X-Admin-Token': 'test_admin_token_123',
        },
      });
    });

    // 验证列表中该项被立即移除
    await waitFor(() => {
      expect(screen.queryByText('梧桐山爬坡训练')).not.toBeInTheDocument();
    });
    expect(screen.getByText('深圳湾晨间巡航')).toBeInTheDocument();
  });

  it('在删除确认时点击取消，不触发 DELETE 请求且保留记录', async () => {
    const user = userEvent.setup();

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/rides') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rides: [...mockRides] }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
    globalThis.fetch = fetchMock as any;

    render(
      <MemoryRouter>
        <ActivitiesList />
      </MemoryRouter>
    );

    await screen.findByText('深圳湾晨间巡航');
    await user.click(screen.getByLabelText('紧凑表格视图'));

    const deleteButtons = screen.getAllByLabelText('删除此记录');
    await user.click(deleteButtons[0]);

    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/rides/ride-001'), expect.anything());
    expect(screen.getByText('深圳湾晨间巡航')).toBeInTheDocument();
  });

  it('未在前端配置令牌时（Zero Trust 托管模式）确认后仍发起 DELETE 请求并移除记录', async () => {
    const user = userEvent.setup();
    localStorage.removeItem('velotrack_admin_token');

    const deleteFetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/rides/ride-002' && init?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, id: 'ride-002' }),
        });
      }
      if (url === '/api/rides') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ rides: [...mockRides] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    globalThis.fetch = deleteFetchMock as any;

    render(
      <MemoryRouter>
        <ActivitiesList />
      </MemoryRouter>
    );

    await screen.findByText('深圳湾晨间巡航');
    await user.click(screen.getByLabelText('紧凑表格视图'));

    const deleteButtons = screen.getAllByLabelText('删除此记录');
    await user.click(deleteButtons[0]);
    await user.click(screen.getByRole('button', { name: '删除记录' }));
    expect(deleteFetchMock).toHaveBeenCalledWith('/api/rides/ride-002', {
      method: 'DELETE',
      headers: {},
    });

    await waitFor(() => {
      expect(screen.queryByText('梧桐山爬坡训练')).not.toBeInTheDocument();
    });
  });
});

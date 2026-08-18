// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../Sidebar';
import type { RiderProfile } from '../../types/rider';

/**
 * Sidebar 导航侧边栏组件测试。
 * 覆盖：导航分组/菜单项渲染、档案与徽标（fetch 成功/失败）、
 * 抽屉开合交互、外部链接新标签页打开。
 */
describe('Sidebar 导航侧边栏', () => {
  const makeJsonResponse = (data: unknown) =>
    new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const profile: RiderProfile = {
    name: '张三',
    gender: 'male',
    weight_kg: 75,
    height_cm: 173,
    max_hr: 188,
    resting_hr: 55,
    ftp_watts: 165,
    current_bike: '大行 P8',
    bike_specs: '',
    injuries_notes: '无',
    primary_goal: '巡航 20km/h',
  };

  // 默认 fetch：档案为空（保留默认状态），无骑行记录，目标周里程 50km
  const defaultFetchImpl = (url: string) => {
    if (url === '/api/ai/rider/profile') return Promise.resolve(makeJsonResponse({ profile: null }));
    if (url === '/api/rides') return Promise.resolve(makeJsonResponse({ rides: [] }));
    if (url === '/api/ai/goals') return Promise.resolve(makeJsonResponse({ goals: { weekly_distance_km: 50 } }));
    return Promise.resolve(makeJsonResponse({}));
  };

  const renderSidebar = (fetchImpl: (url: string) => Promise<Response> = defaultFetchImpl) => {
    const fetchMock = vi.fn(fetchImpl);
    vi.stubGlobal('fetch', fetchMock);
    const utils = render(
      <MemoryRouter initialEntries={['/']}>
        <Sidebar />
      </MemoryRouter>
    );
    return { ...utils, fetchMock };
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeAll(() => {
    // jsdom 未实现 scrollIntoView，打开抽屉时 InterviewTab 的 useEffect 会调用
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('渲染品牌、导航分组与全部菜单项', async () => {
    renderSidebar();
    expect(screen.getByText('VeloTrack')).toBeInTheDocument();
    expect(screen.getByText('科学骑行遥测与训练')).toBeInTheDocument();

    ['核心概览', '骑行遥测', '科学训练', '系统管理'].forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
    ['总览仪表盘', '周期与趋势', '骑行档案', '路线探索', 'AI 教练', '目标与阶梯课表', '数据导入与脱敏'].forEach((item) => {
      expect(screen.getByText(item)).toBeInTheDocument();
    });

    // 等待挂载时的 fetch 完成，避免 act 警告
    await screen.findByText('车手档案');
  });

  it('fetch 失败时回退默认档案与零徽标', async () => {
    const { fetchMock } = renderSidebar(() => Promise.reject(new Error('network')));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3));

    expect(screen.getByText('车手档案')).toBeInTheDocument();
    expect(screen.getByText(/战车 · 75kg/)).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // 骑行档案徽标
    expect(screen.getByText('0%')).toBeInTheDocument(); // 目标进度徽标
  });

  it('fetch 成功时展示档案昵称与骑行数量、目标进度徽标', async () => {
    const rides = [{ start_time: Date.now() - 3600_000, distance_meters: 20000 }];
    const fetchImpl = (url: string) => {
      if (url === '/api/ai/rider/profile') return Promise.resolve(makeJsonResponse({ profile }));
      if (url === '/api/rides') return Promise.resolve(makeJsonResponse({ rides }));
      if (url === '/api/ai/goals') return Promise.resolve(makeJsonResponse({ goals: { weekly_distance_km: 50 } }));
      return Promise.resolve(makeJsonResponse({}));
    };
    renderSidebar(fetchImpl);

    expect(await screen.findByText('张三')).toBeInTheDocument();
    expect(screen.getByText(/大行 · 75kg/)).toBeInTheDocument();
    // 20km / 50km = 40%，骑行 1 条
    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('点击档案卡片打开抽屉，再点关闭收起抽屉', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByLabelText('查看车手生物力学档案与战车硬件'));
    expect(await screen.findByRole('dialog', { name: /车手与战车档案舱/ })).toBeInTheDocument();

    await user.click(screen.getByLabelText('关闭'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('外部链接以新标签页打开', async () => {
    renderSidebar();
    const externalLink = screen.getByRole('link', { name: /数据导入与脱敏/ });
    expect(externalLink).toHaveAttribute('href', 'http://localhost:3001');
    expect(externalLink).toHaveAttribute('target', '_blank');
    // 等待 fetch 完成避免 act 警告
    await screen.findByText('车手档案');
  });
});

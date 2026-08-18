// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RiderProfileDrawer from '../RiderProfileDrawer';
import type { RiderProfile, RiderMemory } from '../../types/rider';

/**
 * RiderProfileDrawer 车手档案抽屉组件测试。
 * 覆盖：关闭时渲染为空、打开时渲染对话框与分段 Tab、关闭回调、
 * 保存修改（fetch PUT 成功/失败）、Tab 切换渲染对应子面板。
 */
describe('RiderProfileDrawer 车手档案抽屉', () => {
  const makeJsonResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const profile: RiderProfile = {
    name: 'VerNe Yuu',
    gender: 'male',
    weight_kg: 75,
    height_cm: 173,
    max_hr: 188,
    resting_hr: 55,
    ftp_watts: 165,
    current_bike: '大行 P8',
    gear_ratio: '46T牙盘 + 11-28T 7速飞轮',
    tires: '马牌 Contact Urban 2.0 轮胎',
    bike_weight_kg: 11.5,
    bike_specs: '46T牙盘 + 11-28T 7速飞轮 | 马牌 Contact Urban 2.0 轮胎',
    custom_specs: '{"pedals": "平踏", "wheelset": "20寸406"}',
    injuries_notes: '右膝半月板轻微劳损史',
    primary_goal: '巡航 20km/h',
  };

  const memories: RiderMemory[] = [
    { id: 1, category: 'health', memory_key: 'knee', content: '右膝注意防护', source: 'manual', created_at: Math.floor(Date.now() / 1000) },
  ];

  // 默认 fetch：GET 档案/记忆成功，PUT 保存成功
  const defaultFetchImpl = (url: string, init?: RequestInit) => {
    if (url === '/api/ai/rider/profile' && init?.method === 'PUT') {
      return Promise.resolve(makeJsonResponse({ ok: true }));
    }
    if (url === '/api/ai/rider/profile') {
      return Promise.resolve(makeJsonResponse({ profile, memories }));
    }
    return Promise.resolve(makeJsonResponse({}));
  };

  const renderDrawer = (
    props: Partial<React.ComponentProps<typeof RiderProfileDrawer>> = {},
    fetchImpl = defaultFetchImpl
  ) => {
    const fetchMock = vi.fn(fetchImpl);
    vi.stubGlobal('fetch', fetchMock);
    const utils = render(<RiderProfileDrawer isOpen={true} onClose={vi.fn()} {...props} />);
    return { ...utils, fetchMock };
  };

  beforeAll(() => {
    // jsdom 未实现 scrollIntoView，InterviewTab/useDialog 相关 effect 会调用
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isOpen=false 时渲染为空', () => {
    const { container } = render(<RiderProfileDrawer isOpen={false} onClose={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  it('打开后渲染对话框、头部信息与分段 Tab', async () => {
    renderDrawer();
    expect(await screen.findByRole('dialog', { name: /车手与战车档案舱/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /车手与战车档案舱/ })).toBeInTheDocument();
    expect(screen.getByText(/大行 P8 · 巡航 20km\/h/)).toBeInTheDocument();

    // 三个分段 Tab
    expect(screen.getByRole('button', { name: /档案与传动/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /快速配置向导/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /习惯与身体备忘/ })).toBeInTheDocument();

    // 默认激活手动档案面板与保存按钮
    expect(screen.getByRole('button', { name: '保存修改' })).toBeInTheDocument();
  });

  it('点击关闭按钮调用 onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer({ onClose });

    await user.click(await screen.findByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('保存修改：提交 PUT 请求并在成功后显示已保存', async () => {
    const user = userEvent.setup();
    const { fetchMock } = renderDrawer();

    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/ai/rider/profile' && (init as RequestInit)?.method === 'PUT'
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body.name).toBe('VerNe Yuu');

    expect(await screen.findByText('已保存')).toBeInTheDocument();
  });

  it('保存失败时不崩溃且按钮恢复可用', async () => {
    const user = userEvent.setup();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failingFetch = (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') return Promise.reject(new Error('network'));
      return defaultFetchImpl(url, init);
    };
    renderDrawer({}, failingFetch);

    await user.click(screen.getByRole('button', { name: '保存修改' }));
    const saveBtn = screen.getByRole('button', { name: /保存修改|正在保存/ });
    await waitFor(() => expect(saveBtn).toBeEnabled());
    errSpy.mockRestore();
  });

  it('切换到快速配置向导与习惯与身体备忘 Tab 渲染对应面板', async () => {
    const user = userEvent.setup();
    renderDrawer();

    await user.click(screen.getByRole('button', { name: /快速配置向导/ }));
    // 访谈输入框
    expect(await screen.findByPlaceholderText(/输入你的硬件或身体参数/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /习惯与身体备忘/ }));
    // 记忆列表与手动添加栏
    expect(await screen.findByText('右膝注意防护')).toBeInTheDocument();
    expect(screen.getByText(/手动添加身体或器材备忘/)).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InterviewTab from '../profile/InterviewTab';
import type { RiderProfile } from '../../types/rider';

/**
 * InterviewTab AI 访谈 Tab 组件测试。
 * 覆盖：欢迎消息与 HUD 渲染、发送消息（fetch 成功/失败）、
 * onProfileUpdated 回调、loading/disabled 分支、快捷芯片。
 */
describe('InterviewTab AI 访谈', () => {
  const baseProfile: RiderProfile = {
    name: 'VerNe',
    gender: 'male',
    weight_kg: 75,
    height_cm: 173,
    max_hr: 188,
    resting_hr: 55,
    ftp_watts: 165,
    current_bike: '大行 P8',
    gear_ratio: '46T牙盘 + 11-28T 7速飞轮',
    tires: '马牌 2.0',
    bike_specs: '',
    injuries_notes: '暂无',
    primary_goal: '',
  };

  const makeFetchResponse = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

  const renderTab = (props: Partial<React.ComponentProps<typeof InterviewTab>> = {}) =>
    render(
      <InterviewTab profile={baseProfile} onProfileUpdated={vi.fn()} {...props} />
    );

  beforeAll(() => {
    // jsdom 未实现 scrollIntoView，组件 useEffect 会调用它
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('渲染欢迎消息与 HUD 参数卡', () => {
    renderTab();
    // 欢迎消息经 Markdown 渲染为标题
    expect(screen.getByRole('heading', { name: /车手与硬件配置向导就绪/ })).toBeInTheDocument();
    expect(screen.getByText('体重')).toBeInTheDocument();
    expect(screen.getByText('75 kg')).toBeInTheDocument();
    // HUD 中车型/齿比以「大行 · 11.5kg」「46T牙盘 · 马牌2.0」的合成文本渲染，需模糊匹配
    expect(screen.getByText(/大行/)).toBeInTheDocument();
    expect(screen.getByText(/46T牙盘/)).toBeInTheDocument();
    expect(screen.getByText('暂无伤病')).toBeInTheDocument();
  });

  it('输入内容后点击发送调用 fetch 并渲染助手回复', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(makeFetchResponse({ reply: '已记录 46T 牙盘升级' }));
    vi.stubGlobal('fetch', fetchMock);
    renderTab();

    const input = screen.getByPlaceholderText(/输入你的硬件或身体参数/);
    await user.type(input, '我改了46T牙盘');
    await user.keyboard('{Enter}');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/ai/rider/interview/chat',
      expect.objectContaining({ method: 'POST' })
    );
    // 用户消息与助手回复都应出现
    expect(await screen.findByText('我改了46T牙盘')).toBeInTheDocument();
    expect(await screen.findByText('已记录 46T 牙盘升级')).toBeInTheDocument();
  });

  it('点击快捷芯片直接发送对应文案', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(makeFetchResponse({ reply: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);
    renderTab();

    await user.click(screen.getByText(/更新46T\/11-28T齿比/));
    expect(await screen.findByText('我的车齿比改成了46T牙盘+11-28T 7速飞轮')).toBeInTheDocument();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.message).toBe('我的车齿比改成了46T牙盘+11-28T 7速飞轮');
  });

  it('响应含 updatedFields 时调用 onProfileUpdated 并展示写入提示', async () => {
    const user = userEvent.setup();
    const onProfileUpdated = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(
      makeFetchResponse({ reply: '已更新', updatedFields: { gear_ratio: '46T/11-28T' } })
    );
    vi.stubGlobal('fetch', fetchMock);
    renderTab({ onProfileUpdated });

    const input = screen.getByPlaceholderText(/输入你的硬件或身体参数/);
    await user.type(input, '齿比改成46T');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onProfileUpdated).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/已写入数据库: gear_ratio/)).toBeInTheDocument();
  });

  it('空输入时点击发送不触发 fetch', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderTab();

    const input = screen.getByPlaceholderText(/输入你的硬件或身体参数/);
    await user.click(input);
    await user.keyboard('{Enter}');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('请求进行中展示加载提示且输入框禁用', async () => {
    const user = userEvent.setup();
    // 永不 resolve 的 Promise 模拟进行中状态
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderTab();

    const input = screen.getByPlaceholderText(/输入你的硬件或身体参数/);
    await user.type(input, '改件');
    await user.keyboard('{Enter}');

    expect(screen.getByText('正在更新战车分立硬件配置...')).toBeInTheDocument();
    expect(input).toBeDisabled();
  });

  it('fetch 失败时不崩溃且输入恢复可用', async () => {
    const user = userEvent.setup();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    renderTab();

    const input = screen.getByPlaceholderText(/输入你的硬件或身体参数/);
    await user.type(input, '改件');
    await user.keyboard('{Enter}');

    // 输入恢复可用
    await waitFor(() => expect(input).not.toBeDisabled());
    errSpy.mockRestore();
  });
});

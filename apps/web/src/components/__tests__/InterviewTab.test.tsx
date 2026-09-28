// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InterviewTab from '../profile/InterviewTab';
import type { RiderProfile } from '../../types/rider';

// 在组件层 mock interviewChat 服务：组件测试只验证渲染与回调，
// 不耦合到服务内部的 Gateway 调用序列（那是 aiProfile 服务自己的测试职责）。
vi.mock('../../services/aiProfile', () => ({
  interviewChat: vi.fn(),
}));

import { interviewChat } from '../../services/aiProfile';

/**
 * InterviewTab AI 访谈 Tab 组件测试。
 * 覆盖：欢迎消息与 HUD 渲染、发送消息（interviewChat 成功/失败）、
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
    chainring: 46,
    cogs: [11, 13, 15, 17, 19, 21, 24, 28],
    wheel_spec: '20x2.0',
    tires: '马牌 2.0',
    primary_goal: '',
  };

  const renderTab = (props: Partial<React.ComponentProps<typeof InterviewTab>> = {}) =>
    render(
      <InterviewTab profile={baseProfile} onProfileUpdated={vi.fn()} {...props} />
    );

  beforeAll(() => {
    // jsdom 未实现 scrollIntoView，组件 useEffect 会调用它
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.mocked(interviewChat).mockReset();
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
    // HUD 展示当前车型与齿比真实值（读 profile）
    expect(screen.getByText(/大行 P8/)).toBeInTheDocument();
    expect(screen.getByText(/46T/)).toBeInTheDocument();
    expect(screen.getByText('未设定')).toBeInTheDocument();
  });

  it('输入内容后点击发送调用 interviewChat 并渲染助手回复', async () => {
    const user = userEvent.setup();
    vi.mocked(interviewChat).mockResolvedValue({ reply: '已记录 46T 牙盘升级', updatedFields: {} });
    renderTab();

    const input = screen.getByPlaceholderText(/输入你的硬件或身体参数/);
    await user.type(input, '我改了46T牙盘');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(interviewChat).toHaveBeenCalledTimes(1));
    expect(interviewChat).toHaveBeenCalledWith('我改了46T牙盘', expect.any(Array));
    // 用户消息与助手回复都应出现
    expect(await screen.findByText('我改了46T牙盘')).toBeInTheDocument();
    expect(await screen.findByText('已记录 46T 牙盘升级')).toBeInTheDocument();
  });

  it('点击快捷芯片直接发送对应文案', async () => {
    const user = userEvent.setup();
    vi.mocked(interviewChat).mockResolvedValue({ reply: 'ok', updatedFields: {} });
    renderTab();

    await user.click(screen.getByText(/更新传动齿比/));
    expect(await screen.findByText('我更新了传动齿比，前牙盘和后飞轮数据已通过档案表填入')).toBeInTheDocument();
    await waitFor(() => expect(interviewChat).toHaveBeenCalledTimes(1));
    expect(interviewChat).toHaveBeenCalledWith(
      '我更新了传动齿比，前牙盘和后飞轮数据已通过档案表填入',
      expect.any(Array)
    );
  });

  it('响应含 updatedFields 时调用 onProfileUpdated 并展示写入提示', async () => {
    const user = userEvent.setup();
    const onProfileUpdated = vi.fn();
    vi.mocked(interviewChat).mockResolvedValue({
      reply: '已更新',
      updatedFields: { chainring: 53 },
    });
    renderTab({ onProfileUpdated });

    const input = screen.getByPlaceholderText(/输入你的硬件或身体参数/);
    await user.type(input, '牙盘换成53T');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onProfileUpdated).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/已写入数据库: chainring/)).toBeInTheDocument();
  });

  it('空输入时点击发送不触发 interviewChat', async () => {
    const user = userEvent.setup();
    renderTab();

    const input = screen.getByPlaceholderText(/输入你的硬件或身体参数/);
    await user.click(input);
    await user.keyboard('{Enter}');
    expect(interviewChat).not.toHaveBeenCalled();
  });

  it('请求进行中展示加载提示且输入框禁用', async () => {
    const user = userEvent.setup();
    // 永不 resolve 的 Promise 模拟进行中状态
    vi.mocked(interviewChat).mockReturnValue(new Promise(() => {}));
    renderTab();

    const input = screen.getByPlaceholderText(/输入你的硬件或身体参数/);
    await user.type(input, '改件');
    await user.keyboard('{Enter}');

    expect(screen.getByText('正在更新战车分立硬件配置...')).toBeInTheDocument();
    expect(input).toBeDisabled();
  });

  it('interviewChat 失败时不崩溃且输入恢复可用', async () => {
    const user = userEvent.setup();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(interviewChat).mockRejectedValue(new Error('network'));
    renderTab();

    const input = screen.getByPlaceholderText(/输入你的硬件或身体参数/);
    await user.type(input, '改件');
    await user.keyboard('{Enter}');

    // 输入恢复可用
    await waitFor(() => expect(input).not.toBeDisabled());
    errSpy.mockRestore();
  });
});

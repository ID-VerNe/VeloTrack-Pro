// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatSidebar from '../chat/ChatSidebar';
import type { SessionSummary } from '../../types/rider';

/**
 * ChatSidebar 会话列表组件测试。
 * 覆盖：isOpen 开关、按时间分组（今日/昨日/近7天/更早）、空态、
 * 选择/新建/删除会话、键盘交互、档案栏点击、aria-pressed 高亮。
 * 注意：每次测试都新建 mock，避免跨用例共享调用记录。
 */
describe('ChatSidebar 会话列表', () => {
  const now = Date.now();
  const day = 24 * 3600 * 1000;

  const sessions: SessionSummary[] = [
    { session_id: 's_today', last_activity: Math.floor(now / 1000), message_count: 3, first_question: '今日会话' },
    { session_id: 's_yesterday', last_activity: Math.floor((now - 1.5 * day) / 1000), message_count: 2, first_question: '昨日会话' },
    { session_id: 's_week', last_activity: Math.floor((now - 3 * day) / 1000), message_count: 1, first_question: '上周会话' },
    { session_id: 's_old', last_activity: Math.floor((now - 10 * day) / 1000), message_count: 5, first_question: '很早的会话' },
  ];

  const makeProps = (overrides: Partial<React.ComponentProps<typeof ChatSidebar>> = {}) => ({
    isOpen: true,
    sessionId: 's_today',
    sessions,
    riderWeight: 70,
    riderBike: '大行P8',
    onSelectSession: vi.fn(),
    onNewSession: vi.fn(),
    onDeleteSession: vi.fn(),
    onOpenProfile: vi.fn(),
    ...overrides,
  });

  it('isOpen 为 false 时不渲染任何内容', () => {
    const { container } = render(<ChatSidebar {...makeProps({ isOpen: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('按最后活跃时间将会话分组展示', () => {
    render(<ChatSidebar {...makeProps()} />);
    expect(screen.getByText('今日推演')).toBeInTheDocument();
    expect(screen.getByText('昨日')).toBeInTheDocument();
    expect(screen.getByText('近 7 天')).toBeInTheDocument();
    expect(screen.getByText('更早之前')).toBeInTheDocument();
    expect(screen.getByText('今日会话')).toBeInTheDocument();
    expect(screen.getByText('昨日会话')).toBeInTheDocument();
    expect(screen.getByText('上周会话')).toBeInTheDocument();
    expect(screen.getByText('很早的会话')).toBeInTheDocument();
  });

  it('无会话时展示空态文案', () => {
    render(<ChatSidebar {...makeProps({ sessions: [] })} />);
    expect(screen.getByText('暂无历史推演')).toBeInTheDocument();
  });

  it('展示车手信息与档案入口', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<ChatSidebar {...props} />);
    expect(screen.getByText('大行P8 · 70kg')).toBeInTheDocument();
    await user.click(screen.getByText('大行P8 · 70kg'));
    expect(props.onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it('点击新会话按钮调用 onNewSession', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<ChatSidebar {...props} />);
    await user.click(screen.getByText('开启新推演会话'));
    expect(props.onNewSession).toHaveBeenCalledTimes(1);
  });

  it('点击会话条目调用 onSelectSession', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<ChatSidebar {...props} />);
    await user.click(screen.getByText('今日会话'));
    expect(props.onSelectSession).toHaveBeenCalledWith('s_today');
  });

  it('按 Enter 键选择会话', () => {
    const props = makeProps();
    render(<ChatSidebar {...props} />);
    const item = screen.getByText('昨日会话').closest('[role="button"]');
    expect(item).not.toBeNull();
    fireEvent.keyDown(item as Element, { key: 'Enter' });
    expect(props.onSelectSession).toHaveBeenCalledWith('s_yesterday');
  });

  it('点击删除按钮调用 onDeleteSession 且不触发选择', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<ChatSidebar {...props} />);
    // 多个会话各有删除按钮，取第一个
    await user.click(screen.getAllByLabelText('删除该会话')[0]);
    expect(props.onDeleteSession).toHaveBeenCalledTimes(1);
    expect(props.onSelectSession).not.toHaveBeenCalled();
  });

  it('删除按钮位于当前会话内时携带对应 session_id', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<ChatSidebar {...props} />);
    const todayItem = screen.getByText('今日会话').closest('[role="button"]') as HTMLElement;
    await user.click(within(todayItem).getByLabelText('删除该会话'));
    expect(props.onDeleteSession).toHaveBeenCalledWith('s_today');
  });

  it('当前会话（sessionId 匹配）带 aria-pressed 标记', () => {
    render(<ChatSidebar {...makeProps()} />);
    const currentItem = screen.getByText('今日会话').closest('[role="button"]');
    expect(currentItem).toHaveAttribute('aria-pressed', 'true');
    const otherItem = screen.getByText('昨日会话').closest('[role="button"]');
    expect(otherItem).toHaveAttribute('aria-pressed', 'false');
  });
});

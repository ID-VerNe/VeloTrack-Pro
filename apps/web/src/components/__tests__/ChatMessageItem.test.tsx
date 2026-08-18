// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ChatMessageItem from '../chat/ChatMessageItem';
import type { ChatMessage } from '../../types/rider';

/**
 * ChatMessageItem 消息气泡组件测试。
 * 覆盖：用户/助手/错误消息渲染、Markdown 渲染、目标/档案 Action Banner、
 * 复制、重新推演回调、disabled 状态。
 *
 * 注意：navigator.clipboard 需要 mock，但 userEvent.setup() 会安装它自己的
 * clipboard stub，因此必须放在 setup() 之后再覆盖。
 */
describe('ChatMessageItem 消息气泡', () => {
  const renderItem = (message: ChatMessage, props: Partial<React.ComponentProps<typeof ChatMessageItem>> = {}) =>
    render(
      <MemoryRouter>
        <ChatMessageItem
          message={message}
          isLoading={false}
          onRegenerate={vi.fn()}
          {...props}
        />
      </MemoryRouter>
    );

  it('用户消息渲染纯文本，且无底部控制栏', () => {
    renderItem({ id: 1, role: 'user', content: '你好教练' });
    expect(screen.getByText('你好教练')).toBeInTheDocument();
    // 用户气泡没有复制/重新推演控制栏
    expect(screen.queryByTitle('复制推演内容')).not.toBeInTheDocument();
    expect(screen.queryByTitle('重新推演此方案')).not.toBeInTheDocument();
  });

  it('助手消息渲染 Markdown 内容与底部控制栏', () => {
    renderItem({ id: 2, role: 'assistant', content: '**训练计划** 已生成' });
    expect(screen.getByText('训练计划')).toBeInTheDocument();
    expect(screen.getByTitle('复制推演内容')).toBeInTheDocument();
    expect(screen.getByTitle('重新推演此方案')).toBeInTheDocument();
  });

  it('错误消息显示错误横幅，点击重新推演调用 onRegenerate', async () => {
    const user = userEvent.setup();
    const onRegenerate = vi.fn();
    renderItem({ id: 3, role: 'assistant', isError: true, content: '网络异常，请重试' }, { onRegenerate });
    expect(screen.getByText('未能获取完整推演结果')).toBeInTheDocument();
    expect(screen.getByText('网络异常，请重试')).toBeInTheDocument();
    await user.click(screen.getByText('重新推演'));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('内容含目标生效文案时渲染目标同步 Banner 与 /goals 链接', () => {
    renderItem({ id: 4, role: 'assistant', content: '你的新目标已生效，继续加油' });
    expect(screen.getByText('阶段训练目标与量化指标已写入生效')).toBeInTheDocument();
    const goalLink = screen.getByRole('link', { name: /查看目标进度/ });
    expect(goalLink).toHaveAttribute('href', '/goals');
  });

  it('tool_calls 含 set_training_goals 时同样触发目标 Banner', () => {
    renderItem({
      id: 5,
      role: 'assistant',
      content: '目标设定完成',
      tool_calls: [{ name: 'set_training_goals', args: { weekly: 50 } }],
    });
    expect(screen.getByText('阶段训练目标与量化指标已写入生效')).toBeInTheDocument();
  });

  it('内容含档案更新文案时渲染档案 Banner，点击查看档案调用 onOpenProfile', async () => {
    const user = userEvent.setup();
    const onOpenProfile = vi.fn();
    renderItem({ id: 6, role: 'assistant', content: '已成功更新档案' }, { onOpenProfile });
    expect(screen.getByText('战车硬件参数与传动规格已成功更新')).toBeInTheDocument();
    await user.click(screen.getByText('查看档案'));
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it('未提供 onOpenProfile 时档案 Banner 不渲染查看档案按钮', () => {
    renderItem({ id: 7, role: 'assistant', content: '已成功更新档案' });
    expect(screen.getByText('战车硬件参数与传动规格已成功更新')).toBeInTheDocument();
    expect(screen.queryByText('查看档案')).not.toBeInTheDocument();
  });

  it('点击复制调用 clipboard.writeText 并显示已复制', async () => {
    // userEvent.setup() 会先安装自身的 clipboard stub，必须在之后覆盖
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    renderItem({ id: 8, role: 'assistant', content: '复制这段内容' });
    await user.click(screen.getByTitle('复制推演内容'));
    expect(writeTextMock).toHaveBeenCalledWith('复制这段内容');
    expect(screen.getByText('已复制')).toBeInTheDocument();
  });

  it('isLoading 时重新推演按钮禁用', () => {
    renderItem({ id: 9, role: 'assistant', content: '方案如下' }, { isLoading: true });
    expect(screen.getByTitle('重新推演此方案')).toBeDisabled();
  });
});

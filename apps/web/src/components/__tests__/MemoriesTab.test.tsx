// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemoriesTab from '../profile/MemoriesTab';
import type { RiderMemory } from '../../types/rider';

/**
 * MemoriesTab 语义记忆列表组件测试。
 * 覆盖：记忆条目渲染（分类徽标/来源标签）、空态、分类过滤、
 * 删除确认流程（确认/取消）、手动添加（含 loading 态）、空值禁用。
 */
describe('MemoriesTab 语义记忆列表', () => {
  const now = Date.now();

  const makeMemories = (): RiderMemory[] => [
    { id: 1, category: 'health', memory_key: 'knee', content: '右膝注意防护', source: 'manual', created_at: Math.floor(now / 1000) },
    { id: 2, category: 'gear', memory_key: 'chainring', content: '46T牙盘体验良好', source: 'coach', created_at: Math.floor(now / 1000) },
    { id: 3, category: 'habit', memory_key: 'morning', content: '喜欢早间骑行', source: 'manual', created_at: Math.floor(now / 1000) },
  ];

  const renderTab = (overrides: Partial<React.ComponentProps<typeof MemoriesTab>> = {}) =>
    render(
      <MemoriesTab
        memories={makeMemories()}
        onAddMemory={vi.fn().mockResolvedValue(undefined)}
        onDeleteMemory={vi.fn().mockResolvedValue(undefined)}
        {...overrides}
      />
    );

  it('渲染记忆条目与分类徽标/来源标签', () => {
    renderTab();
    expect(screen.getByText('右膝注意防护')).toBeInTheDocument();
    expect(screen.getByText('46T牙盘体验良好')).toBeInTheDocument();
    expect(screen.getByText('喜欢早间骑行')).toBeInTheDocument();
    // 分类名同时出现在过滤按钮与条目徽标中，断言至少存在
    expect(screen.getAllByText('身体底线').length).toBeGreaterThan(0);
    expect(screen.getAllByText('战车经验').length).toBeGreaterThan(0);
    expect(screen.getAllByText('习惯偏好').length).toBeGreaterThan(0);
    // 来源标签：coach 来源显示 实战沟通沉淀，manual 显示 手动设定
    expect(screen.getByText('实战沟通沉淀')).toBeInTheDocument();
    expect(screen.getAllByText('手动设定')).toHaveLength(2);
  });

  it('展示全部计数并支持分类过滤', async () => {
    const user = userEvent.setup();
    renderTab();
    expect(screen.getByText('全部 (3)')).toBeInTheDocument();

    // 过滤到 战车调校：只显示 gear 分类
    await user.click(screen.getByRole('button', { name: /战车调校/ }));
    expect(screen.getByText('46T牙盘体验良好')).toBeInTheDocument();
    expect(screen.queryByText('右膝注意防护')).not.toBeInTheDocument();
    expect(screen.queryByText('喜欢早间骑行')).not.toBeInTheDocument();

    // 过滤到 身体底线：只显示 health
    await user.click(screen.getByRole('button', { name: /身体底线/ }));
    expect(screen.getByText('右膝注意防护')).toBeInTheDocument();
    expect(screen.queryByText('46T牙盘体验良好')).not.toBeInTheDocument();
  });

  it('空记忆时展示空态文案', () => {
    renderTab({ memories: [] });
    expect(screen.getByText(/该分类下暂无备忘条目/)).toBeInTheDocument();
  });

  it('删除流程：点击垃圾桶后需确认，确认后调用 onDeleteMemory', async () => {
    const user = userEvent.setup();
    const onDeleteMemory = vi.fn().mockResolvedValue(undefined);
    renderTab({ onDeleteMemory });

    await user.click(screen.getAllByTitle('删除该条备忘')[0]);
    // 出现确认/取消按钮
    const confirmBtn = screen.getByRole('button', { name: '确认' });
    expect(confirmBtn).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();

    await user.click(confirmBtn);
    await waitFor(() => expect(onDeleteMemory).toHaveBeenCalledTimes(1));
    expect(onDeleteMemory).toHaveBeenCalledWith(1);
  });

  it('删除流程：点击取消则不调用 onDeleteMemory', async () => {
    const user = userEvent.setup();
    const onDeleteMemory = vi.fn().mockResolvedValue(undefined);
    renderTab({ onDeleteMemory });

    await user.click(screen.getAllByTitle('删除该条备忘')[0]);
    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(onDeleteMemory).not.toHaveBeenCalled();
    // 确认按钮消失
    expect(screen.queryByRole('button', { name: '确认' })).not.toBeInTheDocument();
  });

  it('手动添加记忆：选择分类、输入内容后调用 onAddMemory 并清空输入', async () => {
    const user = userEvent.setup();
    const onAddMemory = vi.fn().mockResolvedValue(undefined);
    renderTab({ onAddMemory });

    await user.selectOptions(screen.getByRole('combobox'), 'gear');
    await user.type(screen.getByPlaceholderText(/例如：右膝曾有劳损/), '换了新飞轮');
    await user.click(screen.getByRole('button', { name: '添加' }));

    await waitFor(() => expect(onAddMemory).toHaveBeenCalledTimes(1));
    expect(onAddMemory).toHaveBeenCalledWith('gear', '换了新飞轮');
    expect(screen.getByPlaceholderText(/例如：右膝曾有劳损/)).toHaveValue('');
  });

  it('添加中显示 loading 文案且按钮禁用', async () => {
    const user = userEvent.setup();
    // 永不 resolve 的 Promise 模拟添加中
    const onAddMemory = vi.fn(() => new Promise<void>(() => {}));
    renderTab({ onAddMemory });

    await user.type(screen.getByPlaceholderText(/例如：右膝曾有劳损/), '新记忆');
    await user.click(screen.getByRole('button', { name: '添加' }));

    expect(await screen.findByText('添加中...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '添加中...' })).toBeDisabled();
  });

  it('内容为空时添加按钮禁用', () => {
    renderTab();
    expect(screen.getByRole('button', { name: '添加' })).toBeDisabled();
  });
});

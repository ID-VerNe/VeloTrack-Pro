// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import RideTitleHeader from '../ride-detail/RideTitleHeader';

/**
 * RideTitleHeader 骑行标题头测试
 * 覆盖：返回/导出/档案/命名按钮回调、重命名编辑流、AI 生成中态、建议横幅与撤销横幅
 */

function makeBaseProps(overrides: any = {}) {
  return {
    title: '晨间深圳湾',
    fromLabel: '返回骑行列表',
    isSuggestingTitle: false,
    suggestedTitle: null,
    previousTitle: null,
    onGoBack: vi.fn(),
    onSaveTitle: vi.fn(),
    onAIPolishTitle: vi.fn(),
    onApplySuggestedTitle: vi.fn(),
    onCancelSuggestedTitle: vi.fn(),
    onUndoTitle: vi.fn(),
    onExportGPX: vi.fn(),
    onOpenProfile: vi.fn(),
    ...overrides,
  };
}

function renderHeader(overrides: any = {}) {
  const props = makeBaseProps(overrides);
  return { props, ...render(<RideTitleHeader {...props} />) };
}

describe('RideTitleHeader', () => {
  it('渲染标题与返回标签', () => {
    renderHeader();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('晨间深圳湾');
    expect(screen.getByText('返回骑行列表')).toBeInTheDocument();
  });

  it('点击返回/导出/档案分别触发对应回调', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();
    await user.click(screen.getByText('返回骑行列表'));
    expect(props.onGoBack).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('导出 GPX'));
    expect(props.onExportGPX).toHaveBeenCalledTimes(1);

    await user.click(screen.getByText('车手档案'));
    expect(props.onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it('进入编辑态后保存新标题调用 onSaveTitle', async () => {
    const user = userEvent.setup();
    const onSaveTitle = vi.fn();
    renderHeader({ onSaveTitle });
    await user.click(screen.getByRole('button', { name: '手动重命名' }));

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '新标题');
    await user.click(screen.getByTitle('确认保存'));

    expect(onSaveTitle).toHaveBeenCalledWith('新标题');
  });

  it('取消编辑不调用 onSaveTitle 且恢复显示原标题', async () => {
    const user = userEvent.setup();
    const onSaveTitle = vi.fn();
    renderHeader({ onSaveTitle });
    await user.click(screen.getByRole('button', { name: '手动重命名' }));
    await user.type(screen.getByRole('textbox'), '改动内容');
    await user.click(screen.getByTitle('取消修改'));
    expect(onSaveTitle).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('晨间深圳湾');
  });

  it('按 Enter 提交标题', async () => {
    const user = userEvent.setup();
    const onSaveTitle = vi.fn();
    renderHeader({ onSaveTitle });
    await user.click(screen.getByRole('button', { name: '手动重命名' }));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '回车标题{Enter}');
    expect(onSaveTitle).toHaveBeenCalledWith('回车标题');
  });

  it('按 Escape 取消编辑', async () => {
    const user = userEvent.setup();
    const onSaveTitle = vi.fn();
    renderHeader({ onSaveTitle });
    await user.click(screen.getByRole('button', { name: '手动重命名' }));
    await user.type(screen.getByRole('textbox'), 'x{Escape}');
    expect(onSaveTitle).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('晨间深圳湾');
  });

  it('AI 命名按钮触发回调；生成中时禁用并显示文案', async () => {
    const user = userEvent.setup();
    const onAIPolishTitle = vi.fn();
    const { rerender } = renderHeader({ onAIPolishTitle });
    await user.click(screen.getByText('规范路段命名'));
    expect(onAIPolishTitle).toHaveBeenCalledTimes(1);

    rerender(<RideTitleHeader {...makeBaseProps({ onAIPolishTitle, isSuggestingTitle: true })} />);
    expect(screen.getByRole('button', { name: '生成中...' })).toBeDisabled();
  });

  it('建议横幅：应用/忽略触发对应回调', async () => {
    const user = userEvent.setup();
    const onApplySuggestedTitle = vi.fn();
    const onCancelSuggestedTitle = vi.fn();
    renderHeader({
      suggestedTitle: '2026-08-15 深圳湾晨间公路',
      onApplySuggestedTitle,
      onCancelSuggestedTitle,
    });

    // 「」包裹在独立文本节点中，用正则匹配
    expect(screen.getByText(/2026-08-15 深圳湾晨间公路/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '应用' }));
    expect(onApplySuggestedTitle).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '忽略' }));
    expect(onCancelSuggestedTitle).toHaveBeenCalledTimes(1);
  });

  it('撤销横幅显示原标题并触发撤销回调', async () => {
    const user = userEvent.setup();
    const onUndoTitle = vi.fn();
    renderHeader({ previousTitle: '旧标题', onUndoTitle });
    expect(screen.getByText(/原标题：「旧标题」/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '撤销' }));
    expect(onUndoTitle).toHaveBeenCalledTimes(1);
  });

  it('点击删除按钮展示确认横幅，点击确认删除触发 onDelete', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderHeader({ onDelete });
    await user.click(screen.getByTitle('删除此条骑行记录'));
    expect(screen.getByText(/确定要删除此骑行记录吗/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '确认删除' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('在删除确认横幅中点击取消关闭横幅且不触发 onDelete', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderHeader({ onDelete });
    await user.click(screen.getByTitle('删除此条骑行记录'));
    expect(screen.getByText(/确定要删除此骑行记录吗/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByText(/确定要删除此骑行记录吗/)).not.toBeInTheDocument();
  });
});


// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmModal from '../common/ConfirmModal';

describe('ConfirmModal', () => {
  it('当 isOpen 为 false 时不渲染任何内容', () => {
    const { container } = render(
      <ConfirmModal
        isOpen={false}
        title="确认删除"
        description="内容确认"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('当 isOpen 为 true 时正确渲染标题、描述与按钮，并支持点击触发', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ConfirmModal
        isOpen={true}
        title="删除骑行记录"
        description="确定要删除吗？此操作无法撤销。"
        confirmText="删除记录"
        cancelText="取消"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('删除骑行记录')).toBeInTheDocument();
    expect(screen.getByText('确定要删除吗？此操作无法撤销。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '删除记录' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('按 Escape 键触发 onClose', () => {
    const onClose = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        title="测试标题"
        description="测试内容"
        onConfirm={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('加载中时禁用按钮并显示 loadingText', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        isLoading={true}
        loadingText="正在删除..."
        title="测试标题"
        description="测试内容"
        confirmText="确认删除"
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />
    );

    const btn = screen.getByRole('button', { name: '正在删除...' });
    expect(btn).toBeDisabled();
  });
});

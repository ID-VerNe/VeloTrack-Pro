// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import EditGoalsModal from '../goals/EditGoalsModal';

/**
 * EditGoalsModal 目标编辑模态框测试
 * 覆盖：开合渲染、初始值回填、字段编辑、提交回调、取消、保存中禁用态
 */

const initialValues = {
  weeklyDistanceKm: 50,
  targetAvgSpeedKmh: 20,
  monthlyDistanceKm: 150,
  annualDistanceKm: 1000,
  coachNotes: '保持高踏频',
};

describe('EditGoalsModal', () => {
  it('未打开时不渲染任何内容', () => {
    const { container } = render(
      <EditGoalsModal
        isOpen={false}
        initialValues={initialValues}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('打开后回填初始值并渲染四个数字输入', () => {
    render(
      <EditGoalsModal
        isOpen
        initialValues={initialValues}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();
    expect(screen.getByDisplayValue('150')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument();
    expect(screen.getByDisplayValue('保持高踏频')).toBeInTheDocument();
  });

  it('点击取消触发 onClose 且不触发 onSave', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <EditGoalsModal isOpen initialValues={initialValues} onClose={onClose} onSave={onSave} />
    );
    await user.click(screen.getByRole('button', { name: '取消' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('编辑字段后提交：onSave 收到新值并关闭', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <EditGoalsModal isOpen initialValues={initialValues} onClose={onClose} onSave={onSave} />
    );

    const weeklyInput = screen.getByDisplayValue('50');
    await user.clear(weeklyInput);
    await user.type(weeklyInput, '80');

    await user.click(screen.getByRole('button', { name: '保存目标' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ weeklyDistanceKm: 80 }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('保存期间按钮禁用并显示「保存中...」', async () => {
    let resolveSave: (v: void) => void = () => {};
    const onSave = vi.fn().mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolveSave = res;
        })
    );
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <EditGoalsModal isOpen initialValues={initialValues} onClose={onClose} onSave={onSave} />
    );

    await user.click(screen.getByRole('button', { name: '保存目标' }));
    const savingBtn = await screen.findByRole('button', { name: '保存中...' });
    expect(savingBtn).toBeDisabled();

    resolveSave();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '保存目标' })).toBeEnabled()
    );
  });
});

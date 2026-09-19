import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RideTitleBanners from '../ride-detail/RideTitleBanners';

describe('RideTitleBanners', () => {
  it('renders suggested title banner with apply and cancel buttons', () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();

    render(
      <RideTitleBanners
        suggestedTitle="深圳湾日落巡航"
        previousTitle={null}
        onApplySuggestedTitle={onApply}
        onCancelSuggestedTitle={onCancel}
        onUndoTitle={vi.fn()}
      />
    );

    expect(screen.getByText('规范命名建议')).toBeInTheDocument();
    expect(screen.getByText('「深圳湾日落巡航」')).toBeInTheDocument();

    const applyBtn = screen.getByText('应用');
    fireEvent.click(applyBtn);
    expect(onApply).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByText('忽略');
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders undo notification banner with undo action', () => {
    const onUndo = vi.fn();

    render(
      <RideTitleBanners
        suggestedTitle={null}
        previousTitle="旧标题名称"
        onApplySuggestedTitle={vi.fn()}
        onCancelSuggestedTitle={vi.fn()}
        onUndoTitle={onUndo}
      />
    );

    expect(screen.getByText('标题已更新。原标题：「旧标题名称」')).toBeInTheDocument();
    const undoBtn = screen.getByText('撤销');
    fireEvent.click(undoBtn);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RideHeaderToolbar from '../ride-detail/RideHeaderToolbar';

describe('RideHeaderToolbar', () => {
  it('renders navigation button and export/profile action buttons', () => {
    const onGoBack = vi.fn();
    const onExportGPX = vi.fn();
    const onOpenProfile = vi.fn();

    render(
      <RideHeaderToolbar
        fromLabel="返回仪表盘"
        onGoBack={onGoBack}
        onExportGPX={onExportGPX}
        onOpenProfile={onOpenProfile}
      />
    );

    const backBtn = screen.getByLabelText('返回仪表盘');
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(onGoBack).toHaveBeenCalledTimes(1);

    const exportBtn = screen.getByLabelText('导出 GPX 轨迹文件');
    expect(exportBtn).toBeInTheDocument();
    fireEvent.click(exportBtn);
    expect(onExportGPX).toHaveBeenCalledTimes(1);

    const profileBtn = screen.getByLabelText('查看车手生物力学档案与战车硬件');
    expect(profileBtn).toBeInTheDocument();
    fireEvent.click(profileBtn);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it('triggers delete confirmation modal when delete button clicked', () => {
    const onDelete = vi.fn();

    render(
      <RideHeaderToolbar
        fromLabel="返回仪表盘"
        onGoBack={vi.fn()}
        onExportGPX={vi.fn()}
        onOpenProfile={vi.fn()}
        onDelete={onDelete}
      />
    );

    const deleteBtn = screen.getByLabelText('删除此条骑行记录');
    expect(deleteBtn).toBeInTheDocument();
    fireEvent.click(deleteBtn);

    // Modal pops up
    expect(screen.getByText('确定要删除此骑行记录吗？此操作无法撤销。')).toBeInTheDocument();
    const confirmBtn = screen.getByText('确认删除');
    fireEvent.click(confirmBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

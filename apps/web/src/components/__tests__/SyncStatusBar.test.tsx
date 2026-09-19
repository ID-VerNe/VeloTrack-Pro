// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import React from 'react';
import SyncStatusBar from '../common/SyncStatusBar';
import { syncEngine } from '../../services/syncEngine';

describe('SyncStatusBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('初始挂载时处于 synced 状态并显示“已同步”，3秒后折叠', () => {
    vi.spyOn(syncEngine, 'getStatus').mockReturnValue('synced');
    render(<SyncStatusBar />);

    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', '数据已同步，点击手动与云端对齐');
    expect(screen.getByText('已同步')).toBeInTheDocument();

    // 初始展开态包含 px-2.5
    expect(btn).toHaveClass('px-2.5');

    // 推进 3000ms
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    // 3秒后折叠为微点态 p-1.5
    expect(btn).toHaveClass('p-1.5');
  });

  it('鼠标悬停（hover）或获取焦点时平滑展开', () => {
    vi.spyOn(syncEngine, 'getStatus').mockReturnValue('synced');
    render(<SyncStatusBar />);

    // 推进 3000ms 进入折叠态
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('p-1.5');

    // 触发鼠标移入
    fireEvent.mouseEnter(btn);
    expect(btn).toHaveClass('px-2.5');

    // 触发鼠标移出
    fireEvent.mouseLeave(btn);
    expect(btn).toHaveClass('p-1.5');
  });

  it('同步异常或离线状态时常驻展开', () => {
    vi.spyOn(syncEngine, 'getStatus').mockReturnValue('offline');
    render(<SyncStatusBar />);

    // 即使推进 5000ms，离线状态也强制常驻展开
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('px-2.5');
    expect(btn).toHaveAttribute('aria-label', '当前处于离线模式，点击重新连接');
    expect(screen.getByText('离线模式')).toBeInTheDocument();
  });
});

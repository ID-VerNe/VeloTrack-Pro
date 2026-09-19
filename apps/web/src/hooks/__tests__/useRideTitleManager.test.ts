// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRideTitleManager } from '../useRideTitleManager';
import { outboxManager } from '../../services/outboxManager';

vi.mock('../../services/outboxManager', () => ({
  outboxManager: {
    updateRideTitle: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/rideService', () => ({
  updateRideTitle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/aiInsights', () => ({
  suggestRideTitle: vi.fn().mockResolvedValue({ title: 'AI 推荐标题' }),
}));

describe('useRideTitleManager Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saveTitleToBackend 乐观更新 ride 状态并触发 outboxManager', async () => {
    const mockRide = { id: 'ride-1', title: '旧标题' };
    let currentRide = mockRide;
    const setRide = vi.fn((updater) => {
      currentRide = typeof updater === 'function' ? updater(currentRide) : updater;
    });

    const { result } = renderHook(() =>
      useRideTitleManager({
        id: 'ride-1',
        ride: currentRide,
        setRide,
      })
    );

    await act(async () => {
      await result.current.saveTitleToBackend('新标题');
    });

    expect(setRide).toHaveBeenCalled();
    expect(outboxManager.updateRideTitle).toHaveBeenCalledWith('ride-1', '新标题');
  });

  it('handleAIPolishTitle 生成建议标题并支持 8 秒内撤销', async () => {
    const mockRide = {
      id: 'ride-1',
      title: '原始标题',
      distance_meters: 20000,
      avg_speed_kmh: 25,
      total_ascent_meters: 100,
    };
    const setRide = vi.fn();

    const { result } = renderHook(() =>
      useRideTitleManager({
        id: 'ride-1',
        ride: mockRide,
        setRide,
      })
    );

    await act(async () => {
      await result.current.handleAIPolishTitle();
    });

    expect(result.current.previousTitle).toBe('原始标题');

    // 8 秒后 previousTitle 自动清空
    act(() => {
      vi.advanceTimersByTime(8001);
    });

    expect(result.current.previousTitle).toBeNull();
  });

  it('handleUndoTitle 恢复原标题', async () => {
    const mockRide = { id: 'ride-1', title: '修改后标题' };
    const setRide = vi.fn();

    const { result } = renderHook(() =>
      useRideTitleManager({
        id: 'ride-1',
        ride: mockRide,
        setRide,
      })
    );

    // 模拟存在 previousTitle
    await act(async () => {
      await result.current.handleAIPolishTitle();
    });

    expect(result.current.previousTitle).toBe('修改后标题');

    await act(async () => {
      await result.current.handleUndoTitle();
    });

    expect(result.current.previousTitle).toBeNull();
    expect(outboxManager.updateRideTitle).toHaveBeenCalledWith('ride-1', '修改后标题');
  });
});

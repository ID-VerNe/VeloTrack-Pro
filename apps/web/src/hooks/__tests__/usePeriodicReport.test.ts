import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePeriodicReport } from '../usePeriodicReport';
import * as reportService from '../../services/reportService';

vi.mock('../../services/reportService', () => ({
  computePeriodicSummary: vi.fn(),
  generatePeriodInsight: vi.fn(),
}));

describe('usePeriodicReport 周期报表状态机 Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      json: async () => ({
        rides: [
          { id: '1', start_time: 1716163200000 },
        ],
      }),
    } as any);

    vi.mocked(reportService.computePeriodicSummary).mockResolvedValue({
      summary: { total_distance_meters: 50000 },
      rides: [{ id: '1' }],
      timeRange: { start: 1716163200000, end: 1716768000000 },
    } as any);
  });

  it('初始挂载正确加载周期报表数据与初始状态', async () => {
    const { result } = renderHook(() =>
      usePeriodicReport({ initialTimestamp: 1716163200000, initialPeriodType: 'week' })
    );

    expect(result.current.periodType).toBe('week');
    expect(result.current.isLoading).toBe(true);

    // 等待异步完成
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.reportData).toBeDefined();
    expect(result.current.reportData.summary.total_distance_meters).toBe(50000);
  });

  it('切换周期向前翻页更新当前时间戳', async () => {
    const baseTime = 1716163200000;
    const { result } = renderHook(() =>
      usePeriodicReport({ initialTimestamp: baseTime, initialPeriodType: 'week' })
    );

    // 等待初始挂载的 /api/rides 请求完成
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      result.current.handlePrevPeriod();
    });

    // 减去 7 天 = 7 * 86400 * 1000 = 604800000
    expect(result.current.currentTimestamp).toBe(baseTime - 604800000);
  });

  it('生成 AI 洞察并写入 sessionStorage 缓存', async () => {
    vi.mocked(reportService.generatePeriodInsight).mockResolvedValue('本周巡航表现极其稳定');

    const { result } = renderHook(() =>
      usePeriodicReport({ initialTimestamp: 1716163200000, initialPeriodType: 'week' })
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.handleGenerateAiInsight();
    });

    expect(result.current.aiInsight).toBe('本周巡航表现极其稳定');
    expect(reportService.generatePeriodInsight).toHaveBeenCalled();
  });
});

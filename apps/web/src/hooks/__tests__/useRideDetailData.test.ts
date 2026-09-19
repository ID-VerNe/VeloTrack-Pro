import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRideDetailData } from '../useRideDetailData';
import * as storage from '../../utils/storage/indexedDb';
import * as riderService from '../../services/riderService';
import * as aiInsights from '../../services/aiInsights';

vi.mock('../../utils/storage/indexedDb', () => ({
  getLocalRideDetail: vi.fn(),
  saveLocalRideDetail: vi.fn(),
  deleteLocalRide: vi.fn(),
}));

vi.mock('../../services/riderService', () => ({
  getRiderProfile: vi.fn(),
  deleteRide: vi.fn(),
}));

vi.mock('../../services/aiInsights', () => ({
  getRideInsight: vi.fn(),
}));

const mockRide = {
  id: 'r123',
  title: '深圳湾夜巡',
  distance_meters: 20000,
  moving_time_seconds: 3000,
  elapsed_time_seconds: 3200,
  avg_speed_kmh: 24.0,
  total_ascent_meters: 80,
  summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
};

describe('useRideDetailData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (storage.getLocalRideDetail as any).mockResolvedValue(null);
    (storage.saveLocalRideDetail as any).mockResolvedValue(undefined);
    (storage.deleteLocalRide as any).mockResolvedValue(undefined);
    (riderService.getRiderProfile as any).mockResolvedValue({ weight_kg: 70 });
    (aiInsights.getRideInsight as any).mockResolvedValue({
      insight: '踏频与动力输出平衡良好',
      cached: true,
    });

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/rides/r123') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ride: mockRide, detailPoints: [] }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }) as any;
  });

  it('成功加载远程骑行数据并解析指标与卡路里', async () => {
    const { result } = renderHook(() => useRideDetailData({ id: 'r123' }));

    await waitFor(() => expect(result.current.ride).not.toBeNull());

    expect(result.current.ride.title).toBe('深圳湾夜巡');
    expect(result.current.calories).toBeGreaterThan(0);
    expect(result.current.aiInsight).toBe('踏频与动力输出平衡良好');
    expect(result.current.routeCoordinates.length).toBeGreaterThan(0);
  });

  it('0ms 本地优先缓存命中时直接呈现本地数据', async () => {
    (storage.getLocalRideDetail as any).mockResolvedValue({
      ride: { ...mockRide, title: '本地缓存路线' },
      detailPoints: [],
    });
    // 网络较慢时，本地缓存率先呈现
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useRideDetailData({ id: 'r123' }));

    await waitFor(() => expect(result.current.ride).not.toBeNull());
    expect(result.current.ride.title).toBe('本地缓存路线');
  });

  it('删除骑行成功后调用 onDeleteSuccess 回调', async () => {
    const onDeleteSuccess = vi.fn();
    const { result } = renderHook(() =>
      useRideDetailData({ id: 'r123', onDeleteSuccess })
    );

    await waitFor(() => expect(result.current.ride).not.toBeNull());

    await act(async () => {
      await result.current.handleDeleteRide();
    });

    expect(storage.deleteLocalRide).toHaveBeenCalledWith('r123');
    expect(onDeleteSuccess).toHaveBeenCalledTimes(1);
  });
});

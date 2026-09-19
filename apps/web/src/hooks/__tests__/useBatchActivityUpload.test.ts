// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBatchActivityUpload } from '../useBatchActivityUpload';
import { uploadRide } from '../../utils/activity/adminApiClient';
import { parseActivityFile } from '../../utils/activity/activityParser';

vi.mock('../../utils/activity/adminApiClient', () => ({
  uploadRide: vi.fn().mockResolvedValue({ id: 'ride-1' }),
}));

vi.mock('../../utils/activity/activityParser', () => ({
  parseActivityFile: vi.fn().mockReturnValue({
    title: '测试活动',
    start_time: 1700000000000,
    distance_meters: 10000,
    avg_speed_kmh: 25,
    total_ascent_meters: 100,
  }),
}));

vi.mock('../../utils/activity/privacyScrubber', () => ({
  scrubPrivacyZones: vi.fn((data) => data),
}));

vi.mock('../../services/aiInsights', () => ({
  suggestRideTitle: vi.fn().mockResolvedValue({ title: 'AI 标准标题' }),
}));

describe('useBatchActivityUpload Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('当存在 zonesError 时阻断上传并报错', async () => {
    const { result } = renderHook(() =>
      useBatchActivityUpload({
        zones: [],
        activeZoneIds: new Set(),
        zonesError: '令牌无效',
      })
    );

    const mockFile = new File(['content'], 'ride.gpx', { type: 'application/gpx+xml' });

    await act(async () => {
      await result.current.handleBatchFileSelect([mockFile]);
    });

    expect(result.current.uploadStatus).toBe('error');
    expect(result.current.errorMessage).toContain('隐私圈配置未加载成功');
    expect(uploadRide).not.toHaveBeenCalled();
  });

  it('成功解析并上传多个活动文件', async () => {
    const { result } = renderHook(() =>
      useBatchActivityUpload({
        zones: [{ id: 'z1', name: '家', latitude: 22.5, longitude: 113.9, radius_meters: 500 }],
        activeZoneIds: new Set(['z1']),
        zonesError: null,
      })
    );

    const file1 = new File(['content1'], 'ride1.gpx', { type: 'application/gpx+xml' });
    file1.text = vi.fn().mockResolvedValue('<gpx>1</gpx>');

    const file2 = new File(['content2'], 'ride2.tcx', { type: 'application/vnd.garmin.tcx+xml' });
    file2.text = vi.fn().mockResolvedValue('<tcx>2</tcx>');

    await act(async () => {
      await result.current.handleBatchFileSelect([file1, file2]);
    });

    expect(parseActivityFile).toHaveBeenCalledTimes(2);
    expect(uploadRide).toHaveBeenCalledTimes(2);
    expect(result.current.uploadStatus).toBe('success');
  });
});

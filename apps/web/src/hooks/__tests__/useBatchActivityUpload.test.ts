// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBatchActivityUpload } from '../useBatchActivityUpload';
import { uploadRide } from '../../utils/activity/adminApiClient';
import { parseActivityFile } from '../../utils/activity/activityParser';
import { getRiderProfile } from '../../services/riderService';

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

vi.mock('../../services/riderService', () => ({
  getRiderProfile: vi.fn().mockResolvedValue({
    max_hr: 190,
    resting_hr: 60,
    name: '测试车手',
  }),
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

  it('上传前注入车手档案心率到解析器', async () => {
    const { result } = renderHook(() =>
      useBatchActivityUpload({
        zones: [],
        activeZoneIds: new Set(),
        zonesError: null,
      })
    );

    const file = new File(['content'], 'ride.gpx', { type: 'application/gpx+xml' });
    file.text = vi.fn().mockResolvedValue('<gpx>x</gpx>');

    await act(async () => {
      await result.current.handleBatchFileSelect([file]);
    });

    // getRiderProfile 被调用一次
    expect(getRiderProfile).toHaveBeenCalledTimes(1);
    // parseActivityFile 第三参数应携带档案心率 190/60
    expect(parseActivityFile).toHaveBeenCalledWith(
      '<gpx>x</gpx>',
      'ride.gpx',
      { userMaxHr: 190, userRestingHr: 60 }
    );
  });

  it('明细缺失警告(DetailPointsMissing)计入成功并标注', async () => {
    const detailMissing = new Error('明细点位入库失败，本次骑行详情将使用示意曲线');
    (detailMissing as any).code = 'DETAIL_POINTS_MISSING';
    vi.mocked(uploadRide).mockRejectedValueOnce(detailMissing);

    const { result } = renderHook(() =>
      useBatchActivityUpload({
        zones: [],
        activeZoneIds: new Set(),
        zonesError: null,
      })
    );

    const file = new File(['content'], 'ride.gpx', { type: 'application/gpx+xml' });
    file.text = vi.fn().mockResolvedValue('<gpx>x</gpx>');

    await act(async () => {
      await result.current.handleBatchFileSelect([file]);
    });

    // 主记录已入库 → 计为 success，但 errorMessage 标注明细缺失
    expect(result.current.uploadStatus).toBe('success');
    expect(result.current.errorMessage).toContain('明细点位入库失败');
  });
});

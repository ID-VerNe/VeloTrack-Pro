import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAdminToken,
  setAdminToken,
  uploadRide,
  fetchPrivacyZones,
  suggestRideTitle,
} from '../apiClient';
import type { ParsedTCX } from '../tcxParser';

// 构造一个最小的 ParsedTCX 样例（含 points 字段用于验证剥离）
const mockRide = {
  id: '123',
  title: '晨间骑行',
  start_time: 1704067200000,
  end_time: 1704067200000,
  elapsed_time_seconds: 1,
  moving_time_seconds: 1,
  distance_meters: 0,
  max_speed_kmh: 0,
  avg_speed_kmh: 0,
  total_ascent_meters: 0,
  total_descent_meters: 0,
  max_altitude_meters: 0,
  avg_heart_rate: 0,
  max_heart_rate: 0,
  avg_cadence: 0,
  max_cadence: 0,
  calories: 0,
  hr_z1_seconds: 0,
  hr_z2_seconds: 0,
  hr_z3_seconds: 0,
  hr_z4_seconds: 0,
  hr_z5_seconds: 0,
  summary_polyline: '',
  points: [{ time: 1, lat: 30, lng: 120 }],
} as unknown as ParsedTCX;

const suggestInput = {
  start_time: 1704067200000,
  distance_km: 20,
  avg_speed_kmh: 25,
  total_ascent_meters: 100,
};

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('getAdminToken / setAdminToken 令牌存取', () => {
  it('未设置令牌时返回空字符串', () => {
    expect(getAdminToken()).toBe('');
  });

  it('setAdminToken 后 getAdminToken 返回同一令牌', () => {
    setAdminToken('abc123');
    expect(getAdminToken()).toBe('abc123');
  });

  it('不同令牌会覆盖写入', () => {
    setAdminToken('first');
    setAdminToken('second');
    expect(getAdminToken()).toBe('second');
  });
});

describe('uploadRide 上传骑行记录', () => {
  it('主记录入库 POST /api/admin/rides，剥离 points 字段、携带鉴权与 JSON 头', async () => {
    setAdminToken('tok-1');
    // fetch 依次：主上传（POST /api/admin/rides）→ 明细（POST /api/admin/rides/:id/detail-points）
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
    vi.stubGlobal('fetch', mockFetch);

    await uploadRide(mockRide);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const mainCall = mockFetch.mock.calls.find(
      ([url]) => url === '/api/admin/rides'
    );
    expect(mainCall).toBeDefined();
    const [, init] = mainCall!;
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tok-1');
    expect(headers.get('Content-Type')).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body.points).toBeUndefined();
    expect(body.id).toBe('123');
    expect(body.title).toBe('晨间骑行');
  });

  it('明细走 POST /api/admin/rides/:id/detail-points，body 为 JSON 明细对象', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => 'ok' });
    vi.stubGlobal('fetch', mockFetch);

    await uploadRide(mockRide);

    const detailCall = mockFetch.mock.calls.find(
      ([url]) => url === '/api/admin/rides/123/detail-points'
    );
    expect(detailCall).toBeDefined();
    const [, init] = detailCall!;
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('Content-Type')).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body.v).toBe(1);
    expect(Array.isArray(body.points)).toBe(true);
    expect(body.points).toHaveLength(1);
  });

  it('未设置令牌时不携带 Authorization 头', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', mockFetch);

    await uploadRide(mockRide);

    const mainCall = mockFetch.mock.calls.find(
      ([url]) => url === '/api/admin/rides'
    );
    const [, init] = mainCall!;
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBeNull();
  });

  it('主记录响应非 ok 时抛出带响应文本的错误', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, text: async () => 'server exploded' });
    vi.stubGlobal('fetch', mockFetch);

    await expect(uploadRide(mockRide)).rejects.toThrow('Upload failed: server exploded');
  });
});

describe('fetchPrivacyZones 拉取隐私圈', () => {
  it('成功时返回 zones 数组', async () => {
    const zones = [
      { id: '1', name: '家', latitude: 30, longitude: 120, radius_meters: 200 },
    ];
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ zones }) });
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchPrivacyZones()).resolves.toEqual(zones);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/privacy-zones',
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it('401 时抛出特定中文鉴权错误', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchPrivacyZones()).rejects.toThrow(
      '鉴权失败：请先在页面右上角配置有效的管理令牌（ADMIN_TOKEN）'
    );
  });

  it('其他非 ok 状态抛出带 HTTP 状态码的错误', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchPrivacyZones()).rejects.toThrow('拉取隐私圈配置失败（HTTP 503）');
  });

  it('zones 不是数组时抛出格式异常', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ zones: 'nope' }) });
    vi.stubGlobal('fetch', mockFetch);

    await expect(fetchPrivacyZones()).rejects.toThrow('隐私圈配置响应格式异常');
  });
});

describe('suggestRideTitle AI 命名（已迁移到 web 端，admin 桩函数）', () => {
  it('始终返回 null，不再发起 fetch', async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    await expect(suggestRideTitle(suggestInput)).resolves.toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

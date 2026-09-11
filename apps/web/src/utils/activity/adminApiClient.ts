import type { ParsedTCX } from './activityAggregator';
import type { PrivacyZone } from './privacyScrubber';
import { downsamplePoints } from './geoCalculations';

export interface DetailPoint {
  t: number; // 时间戳 (ms)
  la?: number; // 纬度（隐私圈内点该字段缺省）
  ln?: number; // 经度
  al?: number; // 海拔 (m)
  hr?: number; // 心率 (bpm)
  cd?: number; // 踏频 (rpm)
  sp?: number; // 瞬时速度 (km/h)
}

const MAX_DETAIL_POINTS = 1500;

export function getAdminToken(): string {
  return localStorage.getItem('velotrack_admin_token') || '';
}

export function setAdminToken(token: string) {
  localStorage.setItem('velotrack_admin_token', token);
}

async function authFetch(url: string, init: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getAdminToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
}

async function uploadDetailPoints(ride: ParsedTCX): Promise<void> {
  if (!ride.points || ride.points.length === 0) return;
  const sampled = downsamplePoints(ride.points, MAX_DETAIL_POINTS);
  const detail: { v: 1; points: DetailPoint[] } = {
    v: 1,
    points: sampled.map((p) => ({
      t: Math.round(p.time),
      ...(p.lat !== undefined ? { la: p.lat } : {}),
      ...(p.lng !== undefined ? { ln: p.lng } : {}),
      ...(p.altitude !== undefined ? { al: Math.round(p.altitude * 10) / 10 } : {}),
      ...(p.hr !== undefined ? { hr: p.hr } : {}),
      ...(p.cadence !== undefined ? { cd: p.cadence } : {}),
      ...(p.speed !== undefined ? { sp: Math.round(p.speed * 10) / 10 } : {}),
    })),
  };

  const res = await authFetch(`/api/admin/rides/${ride.id}/detail-points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(detail),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Detail points upload failed: ${text}`);
  }
}

export async function uploadRide(ride: ParsedTCX): Promise<void> {
  const { points: _points, ...payload } = ride;
  const res = await authFetch('/api/admin/rides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${text}`);
  }

  try {
    await uploadDetailPoints(ride);
  } catch (err) {
    console.error('逐点明细入库失败，本次骑行详情将使用示意曲线：', err);
  }
}

export async function fetchPrivacyZones(): Promise<PrivacyZone[]> {
  const res = await authFetch('/api/admin/privacy-zones');
  if (res.status === 401) {
    throw new Error('鉴权未通过：Cloudflare 环境变量或后端 ADMIN_TOKEN 校验失败，请检查密钥是否配置且一致');
  }
  if (!res.ok) {
    throw new Error(`拉取隐私圈配置失败（HTTP ${res.status}）`);
  }
  const data = await res.json();
  const zones = data.zones;
  if (!Array.isArray(zones)) {
    throw new Error('隐私圈配置响应格式异常');
  }
  return zones;
}

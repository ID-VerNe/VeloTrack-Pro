import type { ParsedTCX } from './tcxParser';
import type { PrivacyZone } from './privacyScrubber';
import { downsamplePoints } from './geoCalculations';

/**
 * R2 逐点明细格式（短字段名减小体积）。
 * web 端骑行详情图表据此渲染真实海拔/速度曲线，替代此前的正弦合成示意。
 */
export interface DetailPoint {
  t: number; // 时间戳 (ms)
  la?: number; // 纬度（隐私圈内点该字段缺省）
  ln?: number; // 经度
  al?: number; // 海拔 (m)
  hr?: number; // 心率 (bpm)
  cd?: number; // 踏频 (rpm)
  sp?: number; // 瞬时速度 (km/h)
}

// 明细降采样上限：兼顾 dataZoom 缩放粒度与 R2 对象体积（约 200KB）
const MAX_DETAIL_POINTS = 1500;

// 管理令牌：与后端 ADMIN_TOKEN 对应，存于 localStorage（仅在浏览器本地）
export function getAdminToken(): string {
  return localStorage.getItem('velotrack_admin_token') || '';
}
export function setAdminToken(token: string) {
  localStorage.setItem('velotrack_admin_token', token);
}

/** 统一带鉴权头与超时的 fetch 封装 */
async function authFetch(url: string, init: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = getAdminToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * 将脱敏后的逐点明细降采样并上传至 R2，返回存储 key。
 * 失败时抛错由调用方决定是否阻断上传（明细缺失会导致详情页退化为示意曲线）。
 */
async function uploadDetailPoints(ride: ParsedTCX): Promise<string> {
  const key = `rides/${ride.id}.json`;
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

  const form = new FormData();
  form.append(
    'file',
    new File([JSON.stringify(detail)], `${ride.id}.json`, { type: 'application/json' })
  );
  form.append('key', key);

  const res = await authFetch('/api/admin/upload-file', { method: 'POST', body: form });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Detail points upload failed: ${text}`);
  }
  return key;
}

export async function uploadRide(ride: ParsedTCX): Promise<void> {
  // 逐点明细（已脱敏：圈内点坐标为空）降采样后存 R2，
  // 供 web 端骑行详情渲染真实海拔/速度曲线；主记录入库仅存 R2 key
  let detailPointsR2Key: string | null = null;
  if (ride.points && ride.points.length > 0) {
    try {
      detailPointsR2Key = await uploadDetailPoints(ride);
    } catch (err) {
      // 明细上传失败不阻断主记录入库：详情页将降级为示意曲线
      console.error('逐点明细上传 R2 失败，本次骑行详情将使用示意曲线：', err);
    }
  }

  const { points: _points, ...payload } = ride;
  const res = await authFetch('/api/admin/rides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, detail_points_r2_key: detailPointsR2Key }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${text}`);
  }
}

/**
 * 拉取隐私圈配置。
 * 修复：原先任何失败都静默返回 []，导致"拉取失败 = 无圈"，
 * 未脱敏轨迹直接上传。现在失败必须抛错，由调用方阻断上传流程。
 */
export async function fetchPrivacyZones(): Promise<PrivacyZone[]> {
  const res = await authFetch('/api/admin/privacy-zones');
  if (res.status === 401) {
    throw new Error('鉴权失败：请先在页面右上角配置有效的管理令牌（ADMIN_TOKEN）');
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

/** 带 5 秒超时的 AI 智能命名（可选增强功能，失败由调用方静默降级） */
export async function suggestRideTitle(input: {
  start_time: number;
  distance_km: number;
  avg_speed_kmh: number;
  total_ascent_meters: number;
}): Promise<string | null> {
  try {
    const res = await authFetch('/api/ai/rides/suggest-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }, 5000);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.title && !String(data.title).includes('undefined')) {
      return String(data.title);
    }
    return null;
  } catch {
    return null; // 超时/网络失败：标题是可选增强，静默降级
  }
}

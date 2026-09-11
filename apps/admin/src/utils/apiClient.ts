import type { ParsedTCX } from './tcxParser';
import type { PrivacyZone } from './privacyScrubber';
import { downsamplePoints } from './geoCalculations';

/**
 * 逐点明细格式（短字段名减小体积）。
 * PHP 后端将其整体存入 rides.detail_points TEXT 列（无 R2），
 * web 端骑行详情图表据此渲染真实海拔/速度曲线。
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

// 明细降采样上限：兼顾 dataZoom 缩放粒度与 SQLite TEXT 列体积
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
 * 将脱敏后的逐点明细降采样后直接存入 SQLite（detail_points TEXT 列）。
 * 走 POST /api/admin/rides/:id/detail-points，body 为 JSON 明细对象。
 * 失败时抛错由调用方决定是否阻断（明细缺失会导致详情页退化为示意曲线）。
 */
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
  // 主记录入库（POST /api/admin/rides upsert），不含逐点明细
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

  // 逐点明细（已脱敏：圈内点坐标为空）降采样后存 SQLite detail_points 列
  try {
    await uploadDetailPoints(ride);
  } catch (err) {
    // 明细上传失败不阻断主记录入库：详情页将降级为示意曲线
    console.error('逐点明细入库失败，本次骑行详情将使用示意曲线：', err);
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

/**
 * AI 智能命名已迁移到 web 端（aiInsights.suggestRideTitle 直调 Gateway）。
 * admin 端不再持有 AI 逻辑，命名降级为返回 null，由调用方使用规则命名。
 */
export async function suggestRideTitle(_input: {
  start_time: number;
  distance_km: number;
  avg_speed_kmh: number;
  total_ascent_meters: number;
}): Promise<string | null> {
  return null;
}


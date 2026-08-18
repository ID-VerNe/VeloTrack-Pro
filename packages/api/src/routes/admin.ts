import { Hono } from 'hono'
import type { Bindings } from '../types'

export const adminRouter = new Hono<{ Bindings: Bindings }>()

// 获取隐私区域配置
adminRouter.get('/privacy-zones', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM privacy_zones').all()
  return c.json({ zones: results })
})

// 添加或更新隐私区域
adminRouter.post('/privacy-zones', async (c) => {
  const { id, name, latitude, longitude, radius_meters } = await c.req.json()

  // 基本输入校验：坐标与半径必须是合理数值
  if (!id || !name || typeof name !== 'string' || !name.trim()) {
    return c.json({ error: 'id 与 name 不能为空' }, 400)
  }
  const lat = Number(latitude), lng = Number(longitude), radius = Number(radius_meters)
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lng) || lng < -180 || lng > 180 ||
      !Number.isFinite(radius) || radius <= 0 || radius > 10000) {
    return c.json({ error: '坐标或半径数值非法' }, 400)
  }

  await c.env.DB.prepare(
    'INSERT INTO privacy_zones (id, name, latitude, longitude, radius_meters) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, latitude=excluded.latitude, longitude=excluded.longitude, radius_meters=excluded.radius_meters'
  ).bind(String(id), name.trim(), lat, lng, radius).run()

  return c.json({ success: true })
})

// 上传保存单次骑行统计信息
// 使用 ON CONFLICT upsert 而非 INSERT OR REPLACE：
// 1. 保留用户已手动修改的标题（REPLACE 会整行覆盖）
// 2. REPLACE = DELETE+INSERT，若未来启用外键会连带删除关联数据
adminRouter.post('/rides', async (c) => {
  const data = await c.req.json()

  if (!data?.id || typeof data.id !== 'string') {
    return c.json({ error: 'id 不能为空' }, 400)
  }
  if (!Number.isFinite(Number(data.start_time)) || Number(data.start_time) <= 0) {
    return c.json({ error: 'start_time 必须是有效时间戳' }, 400)
  }

  const num = (v: unknown, max = Number.MAX_SAFE_INTEGER): number | null => {
    const n = Number(v)
    if (v === undefined || v === null || v === '' || Number.isNaN(n)) return null
    return Math.min(Math.max(n, -max), max)
  }

  await c.env.DB.prepare(
    `INSERT INTO rides (
      id, title, start_time, end_time, elapsed_time_seconds, moving_time_seconds,
      distance_meters, max_speed_kmh, avg_speed_kmh, total_ascent_meters, total_descent_meters, max_altitude_meters,
      avg_heart_rate, max_heart_rate, avg_cadence, max_cadence, calories,
      hr_z1_seconds, hr_z2_seconds, hr_z3_seconds, hr_z4_seconds, hr_z5_seconds,
      start_lat, start_lng, summary_polyline, detail_points_r2_key, raw_tcx_r2_key, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      start_time=excluded.start_time, end_time=excluded.end_time,
      elapsed_time_seconds=excluded.elapsed_time_seconds, moving_time_seconds=excluded.moving_time_seconds,
      distance_meters=excluded.distance_meters, max_speed_kmh=excluded.max_speed_kmh,
      avg_speed_kmh=excluded.avg_speed_kmh, total_ascent_meters=excluded.total_ascent_meters,
      total_descent_meters=excluded.total_descent_meters, max_altitude_meters=excluded.max_altitude_meters,
      avg_heart_rate=excluded.avg_heart_rate, max_heart_rate=excluded.max_heart_rate,
      avg_cadence=excluded.avg_cadence, max_cadence=excluded.max_cadence, calories=excluded.calories,
      hr_z1_seconds=excluded.hr_z1_seconds, hr_z2_seconds=excluded.hr_z2_seconds,
      hr_z3_seconds=excluded.hr_z3_seconds, hr_z4_seconds=excluded.hr_z4_seconds, hr_z5_seconds=excluded.hr_z5_seconds,
      start_lat=excluded.start_lat, start_lng=excluded.start_lng,
      summary_polyline=excluded.summary_polyline,
      detail_points_r2_key=excluded.detail_points_r2_key, raw_tcx_r2_key=excluded.raw_tcx_r2_key
      -- 注意：title 与 created_at 不在更新列表中，重传不覆盖用户修改
    `
  ).bind(
    ...[
      data.id,
      data.title || `骑行 ${new Date(Number(data.start_time)).toLocaleDateString('zh-CN')}`,
      num(data.start_time), num(data.end_time), num(data.elapsed_time_seconds), num(data.moving_time_seconds),
      num(data.distance_meters), num(data.max_speed_kmh), num(data.avg_speed_kmh),
      num(data.total_ascent_meters), num(data.total_descent_meters), num(data.max_altitude_meters),
      num(data.avg_heart_rate), num(data.max_heart_rate), num(data.avg_cadence), num(data.max_cadence), num(data.calories),
      num(data.hr_z1_seconds), num(data.hr_z2_seconds), num(data.hr_z3_seconds), num(data.hr_z4_seconds), num(data.hr_z5_seconds),
      num(data.start_lat), num(data.start_lng),
      typeof data.summary_polyline === 'string' ? data.summary_polyline : null,
      typeof data.detail_points_r2_key === 'string' ? data.detail_points_r2_key : null,
      typeof data.raw_tcx_r2_key === 'string' ? data.raw_tcx_r2_key : null,
      Date.now()
    ]
  ).run()

  return c.json({ success: true })
})

// 上传大文件到 R2 (通过 Worker 代理或直传)
// 限制：单文件 ≤ 20MB；key 必须匹配白名单格式；contentType 必须在白名单内
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024
const ALLOWED_KEY_PATTERN = /^rides\/[\w.-]+\.(tcx|gpx|json)$/
const ALLOWED_CONTENT_TYPES = new Set([
  'application/xml', 'text/xml', 'application/gpx+xml', 'application/json', ''
])

adminRouter.post('/upload-file', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']
  const key = body['key'] as string

  if (!(file instanceof File)) {
    return c.json({ error: 'Invalid file' }, 400)
  }
  if (!key || !ALLOWED_KEY_PATTERN.test(key)) {
    return c.json({ error: 'key 必须形如 rides/<名称>.tcx|gpx|json' }, 400)
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return c.json({ error: `文件超过 20MB 上限（当前 ${(file.size / 1024 / 1024).toFixed(1)}MB）` }, 413)
  }
  if (file.type && !ALLOWED_CONTENT_TYPES.has(file.type)) {
    return c.json({ error: `不支持的文件类型：${file.type}` }, 415)
  }

  await c.env.BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  })
  return c.json({ success: true, key })
})

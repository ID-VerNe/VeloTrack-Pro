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
  
  await c.env.DB.prepare(
    'INSERT INTO privacy_zones (id, name, latitude, longitude, radius_meters) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, latitude=excluded.latitude, longitude=excluded.longitude, radius_meters=excluded.radius_meters'
  ).bind(id, name, latitude, longitude, radius_meters).run()
  
  return c.json({ success: true })
})

// 上传保存单次骑行统计信息
adminRouter.post('/rides', async (c) => {
  const data = await c.req.json()
  
  await c.env.DB.prepare(
    `INSERT OR REPLACE INTO rides (
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
    )`
  ).bind(
    ...[
      data.id, 
      data.title, 
      data.start_time || 0, 
      data.end_time || 0, 
      data.elapsed_time_seconds || 0, 
      data.moving_time_seconds || 0,
      data.distance_meters || 0, 
      data.max_speed_kmh || 0, 
      data.avg_speed_kmh || 0, 
      data.total_ascent_meters || 0, 
      data.total_descent_meters || 0, 
      data.max_altitude_meters || 0,
      data.avg_heart_rate || 0, 
      data.max_heart_rate || 0, 
      data.avg_cadence || 0, 
      data.max_cadence || 0, 
      data.calories || 0,
      data.hr_z1_seconds || 0, 
      data.hr_z2_seconds || 0, 
      data.hr_z3_seconds || 0, 
      data.hr_z4_seconds || 0, 
      data.hr_z5_seconds || 0,
      data.start_lat, 
      data.start_lng, 
      data.summary_polyline, 
      data.detail_points_r2_key, 
      data.raw_tcx_r2_key, 
      Date.now()
    ].map(v => (v === undefined || Number.isNaN(v as any)) ? null : v)
  ).run()
  
  return c.json({ success: true })
})

// 上传大文件到 R2 (通过 Worker 代理或直传)
adminRouter.post('/upload-file', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']
  const key = body['key'] as string
  
  if (file instanceof File) {
    await c.env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    })
    return c.json({ success: true, key })
  }
  
  return c.json({ error: 'Invalid file' }, 400)
})

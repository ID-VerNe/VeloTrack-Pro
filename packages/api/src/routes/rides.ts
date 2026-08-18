import { Hono } from 'hono'
import type { Bindings } from '../types'

export const ridesRouter = new Hono<{ Bindings: Bindings }>()

// 获取所有骑行记录（用于列表和全局热力图）
ridesRouter.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT id, title, start_time, end_time, elapsed_time_seconds, moving_time_seconds, distance_meters, summary_polyline, total_ascent_meters, avg_speed_kmh, max_speed_kmh, avg_heart_rate FROM rides ORDER BY start_time DESC'
  ).all()
  return c.json({ rides: results })
})

// 获取单次骑行详细数据（含 R2 逐点明细，用于详情页真实海拔/速度曲线渲染）
ridesRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const ride = await c.env.DB.prepare('SELECT * FROM rides WHERE id = ?').bind(id).first()

  if (!ride) {
    return c.json({ error: 'Ride not found' }, 404)
  }

  // 读取 R2 逐点明细；读取失败时静默降级（前端退化为示意曲线），不阻断详情页
  let detailPoints: unknown = null
  const detailKey = (ride as any).detail_points_r2_key
  if (detailKey) {
    try {
      const obj = await c.env.BUCKET.get(detailKey)
      if (obj) {
        const detail = await obj.json<{ v: number; points: unknown[] }>()
        detailPoints = Array.isArray(detail?.points) ? detail.points : null
      }
    } catch (err) {
      console.error(`Failed to read detail points from R2: ${detailKey}`, err)
    }
  }

  return c.json({ ride, detailPoints })
})

// 更新单次骑行信息（例如修改标题/重命名）
ridesRouter.patch('/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const body = await c.req.json()
    const { title } = body

    if (!title || !title.trim()) {
      return c.json({ error: 'Title cannot be empty' }, 400)
    }

    await c.env.DB.prepare('UPDATE rides SET title = ? WHERE id = ?')
      .bind(title.trim(), id)
      .run()

    return c.json({ success: true, title: title.trim() })
  } catch (err: any) {
    return c.json({ error: err.message }, 500)
  }
})

// 删除单次骑行记录（级联清理 R2 逐点明细与 TCX 原文件）
ridesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  try {
    const ride = await c.env.DB.prepare(
      'SELECT id, detail_points_r2_key, raw_tcx_r2_key FROM rides WHERE id = ?'
    )
      .bind(id)
      .first<{ id: string; detail_points_r2_key: string | null; raw_tcx_r2_key: string | null }>()

    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404)
    }

    // 清理 R2 关联对象（若存在）
    if (ride.detail_points_r2_key && c.env.BUCKET) {
      try {
        await c.env.BUCKET.delete(ride.detail_points_r2_key)
      } catch (e) {
        console.error(`Failed to delete R2 detail points: ${ride.detail_points_r2_key}`, e)
      }
    }
    if (ride.raw_tcx_r2_key && c.env.BUCKET) {
      try {
        await c.env.BUCKET.delete(ride.raw_tcx_r2_key)
      } catch (e) {
        console.error(`Failed to delete R2 raw tcx: ${ride.raw_tcx_r2_key}`, e)
      }
    }

    // 删除数据库中的骑行主记录
    await c.env.DB.prepare('DELETE FROM rides WHERE id = ?').bind(id).run()

    return c.json({ success: true, id })
  } catch (err: any) {
    console.error(`Failed to delete ride ${id}:`, err)
    return c.json({ error: err.message || 'Internal Server Error' }, 500)
  }
})


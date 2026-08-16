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

// 获取单次骑行详细数据
ridesRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const ride = await c.env.DB.prepare('SELECT * FROM rides WHERE id = ?').bind(id).first()
  
  if (!ride) {
    return c.json({ error: 'Ride not found' }, 404)
  }
  
  return c.json({ ride })
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

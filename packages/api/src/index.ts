import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { ridesRouter } from './routes/rides'
import { adminRouter } from './routes/admin'
import { aiRouter } from './routes/ai'
import { reportsRouter } from './routes/reports'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())
app.route('/api/rides', ridesRouter)
app.route('/api/admin', adminRouter)
app.route('/api/ai', aiRouter)
app.route('/api/reports', reportsRouter)

export default app

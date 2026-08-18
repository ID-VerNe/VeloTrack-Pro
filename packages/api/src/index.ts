import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Context, Next } from 'hono'
import { ridesRouter } from './routes/rides'
import { adminRouter } from './routes/admin'
import { aiRouter } from './routes/ai'
import { reportsRouter } from './routes/reports'
import type { Bindings } from './types'

const app = new Hono<{ Bindings: Bindings }>()

// CORS 白名单：本地开发端口 + 可通过环境变量扩展（逗号分隔）
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
]

app.use('/api/*', cors({
  origin: (origin: string) => {
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      return origin
    }
    // 非白名单来源：返回 null 表示不回传 Access-Control-Allow-Origin，浏览器侧跨域读取被拒绝
    return null
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}))

// 安全字符串比较（长度不同时仍执行比较，避免时序侧信道）
async function timingSafeEqualStr(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder()
  const bufA = enc.encode(a)
  const bufB = enc.encode(b)
  if (bufA.length !== bufB.length) {
    // 长度不同也要做一次摘要比较，避免泄露长度信息的时间差
    const [ha, hb] = await Promise.all([
      crypto.subtle.digest('SHA-256', bufA),
      crypto.subtle.digest('SHA-256', bufB),
    ])
    return arraysEqual(new Uint8Array(ha), new Uint8Array(hb))
  }
  return arraysEqual(bufA, bufB)
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// 鉴权中间件：ADMIN_TOKEN 已配置时，
// - /api/admin/* 的所有方法均需鉴权（含 GET，防止隐私圈坐标泄露）
// - 其余 /api/* 的非 GET 写操作需鉴权
const authMiddleware = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const token = c.env.ADMIN_TOKEN
  if (!token) return next() // 未配置令牌 = 开放模式（仅限本地开发）

  const path = new URL(c.req.url).pathname
  const isAdmin = path.startsWith('/api/admin')
  const isWrite = c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.method !== 'OPTIONS'
  if (!isAdmin && !isWrite) return next()

  const authHeader = c.req.header('Authorization') || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!bearer || !(await timingSafeEqualStr(bearer, token))) {
    return c.json({ error: 'Unauthorized：请携带有效的 Authorization: Bearer 令牌' }, 401)
  }
  return next()
}

app.use('/api/*', authMiddleware)

// 统一错误处理：不向客户端泄露内部错误细节
app.onError((err, c) => {
  console.error(`[${c.req.method}] ${new URL(c.req.url).pathname}:`, err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

app.route('/api/rides', ridesRouter)
app.route('/api/admin', adminRouter)
app.route('/api/ai', aiRouter)
app.route('/api/reports', reportsRouter)

export default app

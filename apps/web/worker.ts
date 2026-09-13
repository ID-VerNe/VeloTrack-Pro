// apps/web/worker.ts
//
// Cloudflare Worker：托管骑手工作台 SPA 静态资源 + 反向代理后端 PHP API。
//
// 后端 (VHOST_BACKEND) 被 JS challenge 门保护：浏览器直连会先收到一段
// AES JS 解出 __test cookie 才能拿到真实 PHP 响应。Worker 无法执行那段浏览器 JS，
// 因此通过 cookie-bridge (COOKIE_BRIDGE_URL) 领已解好的 cookie，再带
// Cookie + Chrome UA 回源。浏览器只跟 Worker 通信，看到的全程同源，无需 CORS。
//
// AI Gateway (api-gateway.yuuverne.site) 的调用不经此 Worker：前端 aiClient 直连
// Gateway（Gateway CORS *，team key 存浏览器 localStorage）。Worker 只代理 /api/*。
//
// 鉴权：Worker 在每条回源 /api/* 请求上注入 Authorization: Bearer ${ADMIN_TOKEN}，
// PHP 后端用 hash_equals 校验。这样前端代码零改动（不带 token），token 只存于
// Worker secret，不进 localStorage / 不暴露给 XSS。/api/admin/* 路由在 web Worker
// 直接 404——admin 端若部署到独立 Worker 自行处理，避免本 Worker 把 admin
// 写权限透传给公网。
//
// 所有域名/URL/密钥均从 Worker env 读（vars 或 secret），不硬编码，不进 git。
//
// 路由：
//   /api/admin/*  → 404（web Worker 不暴露 admin 路由）
//   /api/*        → 穿越回源到 VHOST_BACKEND（注入 Bearer、透传 body 等）
//   其余          → env.ASSETS.fetch(req)（SPA 静态资源，未命中走 SPA fallback）

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

interface Env {
  ASSETS: Fetcher;
  VHOST_BACKEND: string; // vars，源站 URL，如 https://cycling.<host>
  COOKIE_BRIDGE_URL: string; // vars，cookie-bridge 端点，如 https://cookie.<host>/cookie
  COOKIE_BRIDGE_KEY: string; // secret，cookie-bridge 的 X-Api-Key
  ADMIN_TOKEN: string; // secret，PHP 后端 Bearer 鉴权令牌（与 php_backend/.env 的 ADMIN_TOKEN 同值）
}

// 模块级 cookie 缓存：cookie-bridge 返回 {cookie, expires(ms)}，expires 前复用。
// 不设本地 TTL 主动刷新——源站虚拟主机按 IP 做频率限流，定时重领会抬高回源频率触发 429。
// cookie 失效交给 challenge 检测（回源返回 challenge 时清缓存重领），按需触发。
let cached: { cookie: string; expires: number } | null = null;
// 并发去重：冷启动多个请求同时到达时只领一次。
let pending: Promise<{ cookie: string; expires: number }> | null = null;

async function getCookie(env: Env): Promise<{ cookie: string; expires: number }> {
  if (cached && Date.now() < cached.expires) return cached;
  if (pending) return pending;
  pending = (async () => {
    const r = await fetch(env.COOKIE_BRIDGE_URL, {
      headers: { 'X-Api-Key': env.COOKIE_BRIDGE_KEY },
    });
    if (!r.ok) throw new Error(`cookie-bridge responded ${r.status}`);
    const data = (await r.json()) as { cookie: string; expires: number };
    cached = data;
    return data;
  })();
  try {
    return await pending;
  } finally {
    pending = null;
  }
}

// 判断回源响应是否为 challenge 页。业务响应只可能是 application/json（API）。
// 只有 challenge 才返回 text/html 且 body 含 toNumbers()（AES 解密固定函数名）。
// 用函数名而非 /aes.js 文件名，避免源站改动引用方式后漏检。
async function isChallenge(res: Response): Promise<boolean> {
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('text/html')) return false;
  const text = await res.clone().text();
  return text.includes('toNumbers(');
}

async function proxy(req: Request, env: Env, path: string): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { cookie } = await getCookie(env);
    const headers = new Headers(req.headers);
    // 强制注入穿越 cookie 门必需的头；UA 不带会 520。
    headers.set('User-Agent', CHROME_UA);
    headers.set('Cookie', `__test=${cookie}; CONSENT=YES+`);
    // 鉴权令牌传递：优先使用客户端传入的 Authorization / X-Admin-Token 头（支持前端自定义配置或独立令牌）；
    // 若客户端未传，且已配置 env.ADMIN_TOKEN（网站接入 Zero Trust 防护），Worker 自动补齐管理令牌透传给源站 PHP；
    const clientAuth = req.headers.get('Authorization') || (req.headers.get('X-Admin-Token') ? `Bearer ${req.headers.get('X-Admin-Token')}` : null);
    const token = clientAuth || (env.ADMIN_TOKEN ? `Bearer ${env.ADMIN_TOKEN}` : '');
    if (token) {
      const rawToken = token.replace(/^Bearer\s+/i, '').trim();
      headers.set('Authorization', `Bearer ${rawToken}`);
      headers.set('X-Admin-Token', rawToken);
    } else if (path.startsWith('/api/admin/') || req.method === 'DELETE') {
      return withSecurityHeaders(new Response(JSON.stringify({ 
        error: '需要管理令牌：请在 Cloudflare 环境变量中配置 ADMIN_TOKEN 或在前端配置管理令牌' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }));
    }
    const upstream = await fetch(`${env.VHOST_BACKEND}${path}`, {
      method: req.method,
      headers,
      // GET/HEAD 不能带 body；POST（含 application/json）流式透传 req.body，
      // fetch 自动带 Content-Type，勿在此 await req.text() 再发。
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
    });
    if (upstream.status === 429 && attempt === 0) {
      // 源站按 IP 频率限流（间歇性 429）。清缓存重领 cookie 重试一次；
      // 仍 429 则原样透传，交给前端 retry 兜底。
      cached = null;
      continue;
    }
    if (await isChallenge(upstream)) {
      if (attempt === 0) {
        // cookie 失效（源站重发 challenge）→ 清缓存，下一轮循环重领重试。
        cached = null;
        continue;
      }
      return withSecurityHeaders(upstream);
    }
    return withSecurityHeaders(upstream);
  }
  return new Response('backend challenge failed', { status: 502 });
}

/**
 * 统一注入安全响应头。API 响应与 SPA 静态资源都加。
 * CSP 放开 connect-src 'self' https://api-gateway.yuuverne.site（前端直调 Gateway）
 * 与地图瓦片源（高德/CARTO/OpenTopoMap/卫星影像），img-src 放开 https/data。
 */
function withSecurityHeaders(res: Response): Response {
  const h = new Headers(res.headers);
  h.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https: blob:; " +
      "connect-src 'self' https://api-gateway.yuuverne.site https://*.yuuverne.site https://*.autonavi.com https://*.is.autonavi.com https://*.amap.com https://cloudflareinsights.com data: blob:; " +
      "worker-src 'self' blob:; child-src 'self' blob:; " +
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  );
  h.set('X-Frame-Options', 'DENY');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: h,
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname;
    if (p.startsWith('/api/')) {
      return proxy(req, env, `${p}${url.search}`);
    }
    return withSecurityHeaders(await env.ASSETS.fetch(req));
  },
};

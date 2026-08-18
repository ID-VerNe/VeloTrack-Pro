/**
 * App 级集成测试：CORS 白名单、鉴权中间件（开放/令牌模式）、404、统一错误处理
 * 使用 Miniflare 真实 D1 + Hono app.request 进程内调用
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/index';
import { createTestEnv, disposeMiniflare, resetDb, type TestEnv } from './helpers/testEnv';

let env: TestEnv;

beforeAll(async () => {
  env = await createTestEnv('test-token');
});

afterAll(async () => {
  await disposeMiniflare();
});

describe('CORS 白名单', () => {
  it('允许白名单来源 localhost:3000 并回传 Access-Control-Allow-Origin', async () => {
    const res = await app.request(
      '/api/rides',
      { method: 'GET', headers: { Origin: 'http://localhost:3000' } },
      env.env
    );
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('允许 localhost:3001 与 127.0.0.1 端口', async () => {
    for (const origin of ['http://localhost:3001', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001']) {
      const res = await app.request(
        '/api/rides',
        { method: 'GET', headers: { Origin: origin } },
        env.env
      );
      expect(res.headers.get('access-control-allow-origin')).toBe(origin);
    }
  });

  it('拒绝非白名单来源：不回传 Access-Control-Allow-Origin', async () => {
    const res = await app.request(
      '/api/rides',
      { method: 'GET', headers: { Origin: 'https://evil.example.com' } },
      env.env
    );
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('OPTIONS 预检请求携带允许的方法', async () => {
    const res = await app.request(
      '/api/rides',
      { method: 'OPTIONS', headers: { Origin: 'http://localhost:3000' } },
      env.env
    );
    expect(res.headers.get('access-control-allow-methods')).toContain('GET');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
  });
});

describe('鉴权中间件（配置 ADMIN_TOKEN）', () => {
  it('GET /api/rides 无需令牌可访问（只读）', async () => {
    const res = await app.request('/api/rides', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
  });

  it('POST /api/admin/privacy-zones 未携带令牌返回 401', async () => {
    const res = await app.request(
      '/api/admin/privacy-zones',
      { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } },
      env.env
    );
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/privacy-zones 即使只读也需令牌（防止隐私坐标泄露）', async () => {
    const res = await app.request('/api/admin/privacy-zones', { method: 'GET' }, env.env);
    expect(res.status).toBe(401);
  });

  it('POST 写操作未携带令牌返回 401', async () => {
    const res = await app.request(
      '/api/rides',
      { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } },
      env.env
    );
    expect(res.status).toBe(401);
  });

  it('携带正确 Bearer 令牌可访问管理端点', async () => {
    const res = await app.request(
      '/api/admin/privacy-zones',
      { method: 'GET', headers: { Authorization: 'Bearer test-token' } },
      env.env
    );
    expect(res.status).toBe(200);
  });

  it('携带错误令牌返回 401', async () => {
    const res = await app.request(
      '/api/admin/privacy-zones',
      { method: 'GET', headers: { Authorization: 'Bearer wrong-token' } },
      env.env
    );
    expect(res.status).toBe(401);
  });

  it('非 Bearer 格式的 Authorization 头视为无效', async () => {
    const res = await app.request(
      '/api/admin/privacy-zones',
      { method: 'GET', headers: { Authorization: 'Basic abc123' } },
      env.env
    );
    expect(res.status).toBe(401);
  });
});

describe('鉴权中间件（开放模式，未配置令牌）', () => {
  it('未配置 ADMIN_TOKEN 时所有请求放行', async () => {
    const openEnv = { DB: env.DB, BUCKET: env.BUCKET } as any;
    const res = await app.request(
      '/api/admin/privacy-zones',
      { method: 'POST', body: '{"id":"z1","name":"家","latitude":23.1,"longitude":113.3,"radius_meters":500}', headers: { 'Content-Type': 'application/json' } },
      openEnv
    );
    expect(res.status).toBe(200);
    await resetDb(env.DB);
  });
});

describe('404 与统一错误处理', () => {
  it('未匹配路由返回 404 JSON', async () => {
    const res = await app.request('/api/nonexistent', { method: 'GET' }, env.env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Not Found' });
  });

  it('非 /api 前缀请求不经过 Hono 处理', async () => {
    const res = await app.request('/foo', { method: 'GET' }, env.env);
    expect(res.status).toBe(404);
  });

  it('抛出异常的处理器返回 500 且不泄露内部细节', async () => {
    // 直接构造一个抛错的 app 场景：通过 env 传入一个会抛错的 DB
    const badDb = {
      prepare: () => {
        throw new Error('secret-internal-detail');
      },
    } as any;
    const res = await app.request(
      '/api/rides',
      { method: 'GET' },
      { DB: badDb, BUCKET: env.BUCKET } as any
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal Server Error' });
  });
});

/**
 * /api/ai/config 路由测试：配置读取（脱敏）、更新、连通性测试
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import app from '../src/index';
import { createTestEnv, disposeMiniflare, resetDb, type TestEnv } from './helpers/testEnv';
import { mockAiFetch, unstubAiFetch } from './helpers/aiMock';

let env: TestEnv;
const jsonHeaders = { 'Content-Type': 'application/json' };

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await disposeMiniflare();
});

beforeEach(async () => {
  await resetDb(env.DB);
});

afterEach(() => {
  unstubAiFetch();
});

describe('GET /api/ai/config', () => {
  it('默认配置：空 base_url、默认模型、未配置 key', async () => {
    const res = await app.request('/api/ai/config', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config).toMatchObject({
      base_url: '',
      model_name: 'deepseek-v4-flash',
      api_key: '',
      api_key_configured: false,
    });
  });

  it('长 key 脱敏为 前3+****+后4', async () => {
    await env.DB.prepare(
      "UPDATE ai_config SET api_key = 'sk-abcdefghijklmnopqrstuvwxyz0123456789' WHERE id = 1"
    ).run();
    const res = await app.request('/api/ai/config', { method: 'GET' }, env.env);
    const body = await res.json();
    expect(body.config.api_key).toBe('sk-****6789');
    expect(body.config.api_key_configured).toBe(true);
  });

  it('短 key（<=8）脱敏为 ****', async () => {
    await env.DB.prepare("UPDATE ai_config SET api_key = 'shortkey' WHERE id = 1").run();
    const res = await app.request('/api/ai/config', { method: 'GET' }, env.env);
    const body = await res.json();
    expect(body.config.api_key).toBe('****');
  });
});

describe('PUT /api/ai/config', () => {
  const valid = { base_url: 'https://api.example.com/v1', model_name: 'my-model', api_key: 'sk-real-key' };

  it('保存合法配置成功', async () => {
    const res = await app.request(
      '/api/ai/config',
      { method: 'PUT', body: JSON.stringify(valid), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT * FROM ai_config WHERE id = 1').first<any>();
    expect(row.base_url).toBe('https://api.example.com/v1');
    expect(row.api_key).toBe('sk-real-key');
  });

  it('非法 base_url 返回 400（非 http/https 协议）', async () => {
    for (const badUrl of ['ftp://x.com', 'javascript:alert(1)', 'not a url', '']) {
      const res = await app.request(
        '/api/ai/config',
        { method: 'PUT', body: JSON.stringify({ ...valid, base_url: badUrl }), headers: jsonHeaders },
        env.env
      );
      expect(res.status).toBe(400);
    }
  });

  it('空 model_name 返回 400', async () => {
    const res = await app.request(
      '/api/ai/config',
      { method: 'PUT', body: JSON.stringify({ ...valid, model_name: '  ' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(400);
  });

  it('api_key 为空或含 **** 时不覆盖已存 key', async () => {
    await env.DB.prepare("UPDATE ai_config SET api_key = 'sk-secret' WHERE id = 1").run();
    // 空 key
    await app.request(
      '/api/ai/config',
      { method: 'PUT', body: JSON.stringify({ ...valid, api_key: '' }), headers: jsonHeaders },
      env.env
    );
    let row = await env.DB.prepare('SELECT api_key FROM ai_config WHERE id = 1').first<any>();
    expect(row.api_key).toBe('sk-secret');
    // 脱敏回显值
    await app.request(
      '/api/ai/config',
      { method: 'PUT', body: JSON.stringify({ ...valid, api_key: 'sk-****xxx' }), headers: jsonHeaders },
      env.env
    );
    row = await env.DB.prepare('SELECT api_key FROM ai_config WHERE id = 1').first<any>();
    expect(row.api_key).toBe('sk-secret');
  });
});

describe('POST /api/ai/test-connection', () => {
  beforeEach(async () => {
    await env.DB.prepare(
      "UPDATE ai_config SET base_url = 'https://api.example.com/v1', api_key = 'sk-test', model_name = 'm' WHERE id = 1"
    ).run();
  });

  it('未配置 base_url 时返回 400', async () => {
    await env.DB.prepare("UPDATE ai_config SET base_url = '' WHERE id = 1").run();
    const res = await app.request('/api/ai/test-connection', { method: 'POST', headers: jsonHeaders }, env.env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('上游返回成功时返回成功与延迟', async () => {
    const { calls } = mockAiFetch({ content: '连接成功' });
    const res = await app.request('/api/ai/test-connection', { method: 'POST', headers: jsonHeaders }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.reply).toBe('连接成功');
    expect(body.model).toBe('m');
    expect(typeof body.latencyMs).toBe('number');
    expect(calls).toHaveLength(1);
    // 校验请求体包含 model 与 messages
    expect(calls[0].body.model).toBe('m');
  });

  it('上游 HTTP 错误返回 400 且不泄露完整错误', async () => {
    mockAiFetch({ httpStatus: 401 });
    const res = await app.request('/api/ai/test-connection', { method: 'POST', headers: jsonHeaders }, env.env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('HTTP 401');
  });

  it('网络错误返回 502（AIServiceError）', async () => {
    mockAiFetch({ networkError: true });
    const res = await app.request('/api/ai/test-connection', { method: 'POST', headers: jsonHeaders }, env.env);
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

/**
 * /api/ai/rides 路由测试：单次骑行生理复盘（含缓存）、AI 智能命名
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import app from '../src/index';
import { createTestEnv, disposeMiniflare, resetDb, type TestEnv } from './helpers/testEnv';
import { mockAiFetch, unstubAiFetch } from './helpers/aiMock';

let env: TestEnv;
const jsonHeaders = { 'Content-Type': 'application/json' };

// 足够长的洞察文本（>350 字）且含 配速/地形/建议 关键词，满足缓存命中条件
const LONG_INSIGHT = `配速与骑行节奏分析：本次骑行停表均速 21.8km/h，总均速 19.2km/h，停顿时间 5 分钟，
红绿灯对节奏影响有限，起步与停车各损失约 40 秒做功窗口。物理引擎计算齿比匹配度良好，
平路巡航做功效率较高，建议红灯起步提前降档至 46/17T 轻蹬防伤膝，绿灯后保持 90rpm 稳定踩踏。
地形适应与体能消耗：累计爬升 180 米，物理引擎计算重力势能做功约 51 千焦，爬升均摊功率约 42 瓦，
负荷评级为低强度有氧。右膝半月板受力在安全范围，踏频全程维持在 85-95rpm 区间，
Karvonen 生理区间评估有氧负荷适中，未见超过 Zone 3 的持续高强度区间。
下阶段训练与恢复建议：建议保持每周三次高踏频有氧训练，每次 60 分钟以上，
注意齿比选择与恢复，平路高踏频专项训练提升巡航效率，同时安排一次爬坡练习验证齿比分配。
整体训练负荷适中，结合车手阶段目标，建议逐步提升单次里程与巡航均速至 22km/h 门槛。`;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await disposeMiniflare();
});

beforeEach(async () => {
  await resetDb(env.DB);
  await env.DB.prepare(
    `INSERT INTO rides (id, title, start_time, end_time, elapsed_time_seconds, moving_time_seconds, distance_meters, avg_speed_kmh, max_speed_kmh, total_ascent_meters, avg_heart_rate, created_at)
     VALUES ('ride-1', '测试骑行', 1700000000000, 1700003600000, 3600, 3300, 20000, 21.8, 45.2, 180, 150, 1700000000000)`
  ).run();
  await env.DB.prepare(
    "UPDATE ai_config SET base_url = 'https://api.example.com/v1', api_key = 'sk-test', model_name = 'm' WHERE id = 1"
  ).run();
});

afterEach(() => {
  unstubAiFetch();
});

describe('GET /api/ai/rides/:id/insight 生理复盘', () => {
  it('骑行不存在返回 404', async () => {
    const res = await app.request('/api/ai/rides/nope/insight', { method: 'GET' }, env.env);
    expect(res.status).toBe(404);
  });

  it('首次生成洞察并写入缓存表', async () => {
    const { calls } = mockAiFetch({ content: LONG_INSIGHT });
    const res = await app.request('/api/ai/rides/ride-1/insight', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insight).toBe(LONG_INSIGHT);
    expect(body.cached).toBe(false);
    expect(calls).toHaveLength(1);

    const cached = await env.DB.prepare('SELECT * FROM ride_insights WHERE ride_id = ?').bind('ride-1').first<any>();
    expect(cached).not.toBeNull();
    expect(cached.content_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('相同内容二次请求命中缓存且不再调用 AI', async () => {
    mockAiFetch({ content: LONG_INSIGHT });
    await app.request('/api/ai/rides/ride-1/insight', { method: 'GET' }, env.env);
    const { calls } = mockAiFetch({ content: LONG_INSIGHT });
    const res = await app.request('/api/ai/rides/ride-1/insight', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(body.insight).toBe(LONG_INSIGHT);
    expect(calls).toHaveLength(0); // 未发起 AI 请求
  });

  it('force=true 强制重新生成', async () => {
    mockAiFetch({ content: LONG_INSIGHT });
    await app.request('/api/ai/rides/ride-1/insight', { method: 'GET' }, env.env);
    const { calls } = mockAiFetch({ content: LONG_INSIGHT });
    const res = await app.request('/api/ai/rides/ride-1/insight?force=true', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cached).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('AI 上游错误返回 502', async () => {
    mockAiFetch({ httpStatus: 500 });
    const res = await app.request('/api/ai/rides/ride-1/insight', { method: 'GET' }, env.env);
    expect(res.status).toBe(502);
  });
});

describe('POST /api/ai/rides/suggest-title 智能命名', () => {
  it('非法 start_time 返回 400', async () => {
    const res = await app.request(
      '/api/ai/rides/suggest-title',
      { method: 'POST', body: JSON.stringify({ start_time: 0 }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(400);
  });

  it('成功生成并清理引号与首尾空白', async () => {
    mockAiFetch({ content: '"周末千岛湖巡航"' });
    const res = await app.request(
      '/api/ai/rides/suggest-title',
      { method: 'POST', body: JSON.stringify({ start_time: 1700000000000, distance_km: 50.2, avg_speed_kmh: 21, total_ascent_meters: 300, city: '杭州' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe('周末千岛湖巡航');
  });

  it('上游错误返回 502', async () => {
    mockAiFetch({ httpStatus: 429 });
    const res = await app.request(
      '/api/ai/rides/suggest-title',
      { method: 'POST', body: JSON.stringify({ start_time: 1700000000000 }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(502);
  });
});

/**
 * /api/reports 路由测试：周期汇总（周/月/半年/年）与 AI 周期复盘
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
  await env.DB.prepare(
    "UPDATE ai_config SET base_url = 'https://api.example.com/v1', api_key = 'sk-test', model_name = 'm' WHERE id = 1"
  ).run();
});

afterEach(() => {
  unstubAiFetch();
});

describe('GET /api/reports/summary 周期汇总', () => {
  it('空库返回零值汇总且结构完整', async () => {
    const res = await app.request('/api/reports/summary?type=week', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.total_distance_km).toBe(0);
    expect(body.summary.rides_count).toBe(0);
    expect(body.timeline.labels).toHaveLength(7);
    expect(body.rides).toEqual([]);
  });

  it('week 类型：汇总当周骑行并按 7 天拆解时间线', async () => {
    // 使用本周一 00:00 作为参考时间戳
    const ref = new Date();
    const day = ref.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(ref);
    monday.setDate(ref.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    const mondayTs = monday.getTime();

    await env.DB.prepare(
      `INSERT INTO rides (id, title, start_time, end_time, elapsed_time_seconds, moving_time_seconds, distance_meters, avg_speed_kmh, max_speed_kmh, total_ascent_meters, created_at)
       VALUES ('r1', '周一骑', ?, ? + 3600000, 3600, 3300, 21000, 22.9, 45, 200, ?)`,
    ).bind(mondayTs, mondayTs, mondayTs).run();

    const res = await app.request(`/api/reports/summary?type=week&timestamp=${mondayTs + 3600 * 1000}`, { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.total_distance_km).toBe(21);
    expect(body.summary.rides_count).toBe(1);
    expect(body.summary.active_days_count).toBe(1);
    // 21km / 3300s → 22.9 km/h
    expect(body.summary.moving_avg_speed_kmh).toBe(22.9);
    expect(body.summary.max_speed_kmh).toBe(45);
    expect(body.timeline.distance.reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(21, 1);
  });

  it('month 类型返回 4 周时间线', async () => {
    const res = await app.request('/api/reports/summary?type=month', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timeline.labels).toHaveLength(4);
  });

  it('half_year 类型返回 6 个月时间线', async () => {
    const res = await app.request('/api/reports/summary?type=half_year', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timeline.labels).toHaveLength(6);
  });

  it('year 类型返回 12 个月时间线', async () => {
    const res = await app.request('/api/reports/summary?type=year', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timeline.labels).toHaveLength(12);
  });

  it('未知周期类型按年兜底', async () => {
    const res = await app.request('/api/reports/summary?type=unknown', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timeline.labels).toHaveLength(12);
  });
});

describe('POST /api/reports/insight AI 周期复盘', () => {
  it('缺少 summary 返回 400', async () => {
    const res = await app.request(
      '/api/reports/insight',
      { method: 'POST', body: JSON.stringify({ period_type: 'week' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(400);
  });

  it('summary 缺少 total_distance_km 返回 400', async () => {
    const res = await app.request(
      '/api/reports/insight',
      { method: 'POST', body: JSON.stringify({ period_type: 'week', summary: { moving_time_seconds: 3600 } }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(400);
  });

  it('合法请求生成 AI 复盘', async () => {
    const { calls } = mockAiFetch({ content: '本周训练负荷适中，建议加强高踏频有氧训练。' });
    const res = await app.request(
      '/api/reports/insight',
      {
        method: 'POST',
        body: JSON.stringify({
          period_type: 'week',
          rides_count: 3,
          summary: {
            total_distance_km: 60.5,
            moving_time_seconds: 10800,
            elapsed_time_seconds: 12000,
            paused_time_seconds: 1200,
            moving_ratio_pct: 90,
            total_ascent_meters: 500,
            avg_speed_kmh: 20.2,
            moving_avg_speed_kmh: 20.2,
            elapsed_avg_speed_kmh: 18.2,
            distance_change_pct: 12.5,
            ascent_change_pct: 8,
            max_speed_kmh: 45,
            calories: 1200,
            active_days_count: 3,
          },
        }),
        headers: jsonHeaders,
      },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.insight).toContain('高踏频');
    expect(calls).toHaveLength(1);
    // 校验系统提示词引用了用户档案
    expect(calls[0].body.messages[0].content).toContain('VeloTrack');
  });

  it('AI 上游错误返回 502', async () => {
    mockAiFetch({ httpStatus: 500 });
    const res = await app.request(
      '/api/reports/insight',
      {
        method: 'POST',
        body: JSON.stringify({ period_type: 'week', rides_count: 1, summary: { total_distance_km: 10, moving_time_seconds: 3600, elapsed_time_seconds: 4000, paused_time_seconds: 400, moving_ratio_pct: 90, total_ascent_meters: 100, avg_speed_kmh: 10, distance_change_pct: 0, ascent_change_pct: 0, max_speed_kmh: 30, calories: 200, active_days_count: 1 } }),
        headers: jsonHeaders,
      },
      env.env
    );
    expect(res.status).toBe(502);
  });
});

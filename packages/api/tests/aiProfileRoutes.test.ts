/**
 * /api/ai/rider 路由测试：车手档案、训练目标、语义记忆 CRUD、建档评估对话
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

describe('车手档案 rider/profile', () => {
  it('GET 返回默认档案、记忆与目标', async () => {
    const res = await app.request('/api/ai/rider/profile', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.name).toBe('VerNe Yuu');
    expect(body.profile.weight_kg).toBe(75);
    expect(Array.isArray(body.memories)).toBe(true);
    expect(body.goals.weekly_distance_km).toBe(60);
    expect(Array.isArray(body.milestones)).toBe(true);
  });

  it('PUT 更新体重等字段并保留未提交字段', async () => {
    const res = await app.request(
      '/api/ai/rider/profile',
      { method: 'PUT', body: JSON.stringify({ weight_kg: 72, current_bike: '大行 P8' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profile.weight_kg).toBe(72);
    expect(body.profile.height_cm).toBe(173); // 未提交字段保留
  });

  it('PUT 更新 custom_specs 时与既有配件合并而非覆盖', async () => {
    // 默认 custom_specs 为 {"pedals":"平踏","wheelset":"20寸406"}
    await app.request(
      '/api/ai/rider/profile',
      { method: 'PUT', body: JSON.stringify({ custom_specs: { saddle: '舒适座垫' } }), headers: jsonHeaders },
      env.env
    );
    const res = await app.request('/api/ai/rider/profile', { method: 'GET' }, env.env);
    const body = await res.json();
    const specs = JSON.parse(body.profile.custom_specs);
    expect(specs.pedals).toBe('平踏');
    expect(specs.wheelset).toBe('20寸406');
    expect(specs.saddle).toBe('舒适座垫');
  });

  it('PUT 只改齿比不丢外胎（局部合并）', async () => {
    await app.request(
      '/api/ai/rider/profile',
      { method: 'PUT', body: JSON.stringify({ gear_ratio: '46T牙盘 + 11-28T 7速飞轮' }), headers: jsonHeaders },
      env.env
    );
    const res = await app.request('/api/ai/rider/profile', { method: 'GET' }, env.env);
    const body = await res.json();
    expect(body.profile.tires).toContain('马牌 Contact Urban 2.0');
  });
});

describe('训练目标 goals', () => {
  it('GET 返回目标与档案', async () => {
    const res = await app.request('/api/ai/goals', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goals.annual_distance_km).toBe(1000);
    expect(body.profile).toBeDefined();
    expect(Array.isArray(body.milestones)).toBe(true);
  });

  it('PUT 更新目标并联动更新 primary_goal', async () => {
    const res = await app.request(
      '/api/ai/goals',
      { method: 'PUT', body: JSON.stringify({ weekly_distance_km: 80, primary_goal: '进阶 50km 耐力' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goals.weekly_distance_km).toBe(80);
    // primary_goal 联动写入档案
    const profile = await env.DB.prepare('SELECT primary_goal FROM rider_profile WHERE id = 1').first<any>();
    expect(profile.primary_goal).toBe('进阶 50km 耐力');
  });
});

describe('语义记忆 memories', () => {
  it('POST 新增记忆并可在档案中读取', async () => {
    const res = await app.request(
      '/api/ai/rider/memories',
      { method: 'POST', body: JSON.stringify({ category: 'health', memory_key: 'knee_test', content: '测试记忆内容', importance: 4 }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.id).toBeGreaterThan(0);

    const profileRes = await app.request('/api/ai/rider/profile', { method: 'GET' }, env.env);
    const profile = await profileRes.json();
    const memory = profile.memories.find((m: any) => m.memory_key === 'knee_test');
    expect(memory.content).toBe('测试记忆内容');
    expect(memory.category).toBe('health');
  });

  it('空 content 返回 400', async () => {
    const res = await app.request(
      '/api/ai/rider/memories',
      { method: 'POST', body: JSON.stringify({ category: 'habit', content: '   ' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(400);
  });

  it('同 memory_key 重复提交走去重更新', async () => {
    const payload = { category: 'gear', memory_key: 'tire', content: '外胎 A', importance: 3 };
    for (let i = 0; i < 2; i++) {
      await app.request('/api/ai/rider/memories', { method: 'POST', body: JSON.stringify(payload), headers: jsonHeaders }, env.env);
    }
    const rows = await env.DB.prepare("SELECT * FROM rider_memories WHERE memory_key = 'tire'").all<any>();
    expect(rows.results).toHaveLength(1);
  });

  it('DELETE 删除记忆', async () => {
    const created = await app.request(
      '/api/ai/rider/memories',
      { method: 'POST', body: JSON.stringify({ category: 'habit', memory_key: 'tmp', content: '临时记忆' }), headers: jsonHeaders },
      env.env
    );
    const { id } = await created.json();
    const res = await app.request(`/api/ai/rider/memories/${id}`, { method: 'DELETE' }, env.env);
    expect(res.status).toBe(200);
    const rows = await env.DB.prepare('SELECT * FROM rider_memories WHERE id = ?').bind(id).all<any>();
    expect(rows.results).toHaveLength(0);
  });
});

describe('建档评估对话 rider/interview/chat', () => {
  beforeEach(async () => {
    // 对话需要已配置的 AI base_url，否则 callAICompletion 会在调用 fetch 前抛错
    await env.DB.prepare(
      "UPDATE ai_config SET base_url = 'https://api.example.com/v1', api_key = 'sk-test', model_name = 'm' WHERE id = 1"
    ).run();
  });

  it('缺少 message 返回 400', async () => {
    const res = await app.request(
      '/api/ai/rider/interview/chat',
      { method: 'POST', body: JSON.stringify({ history: [] }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(400);
  });

  it('模型直接回复（无工具调用）时返回 reply', async () => {
    mockAiFetch({ content: '好的，请告诉我你的体重。' });
    const res = await app.request(
      '/api/ai/rider/interview/chat',
      { method: 'POST', body: JSON.stringify({ message: '我体重 72kg' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe('好的，请告诉我你的体重。');
    expect(body.updatedFields).toEqual({});
  });

  it('模型调用 update_profile 工具时更新档案并返回 updatedFields', async () => {
    mockAiFetch({
      sequence: [
        // 第一轮：请求工具调用
        {
          toolCalls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'update_profile', arguments: JSON.stringify({ weight_kg: 72, gear_ratio: '46T牙盘 + 11-28T 7速飞轮' }) },
          }],
        },
        // 第二轮：工具结果后的回复
        { content: '已更新你的体重为 72kg，齿比保持不变。' },
      ],
    });
    const res = await app.request(
      '/api/ai/rider/interview/chat',
      { method: 'POST', body: JSON.stringify({ message: '我换了 7 速飞轮，体重 72kg' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updatedFields.weight_kg).toBe(72);
    expect(body.reply).toContain('已更新');

    const profile = await env.DB.prepare('SELECT weight_kg, tires FROM rider_profile WHERE id = 1').first<any>();
    expect(profile.weight_kg).toBe(72);
    // 外胎未被工具调用抹掉
    expect(profile.tires).toContain('马牌 Contact Urban 2.0');
  });

  it('上游失败时返回兜底回复', async () => {
    mockAiFetch({ httpStatus: 500 });
    const res = await app.request(
      '/api/ai/rider/interview/chat',
      { method: 'POST', body: JSON.stringify({ message: '你好' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toBe('已记录你的回答。');
  });
});

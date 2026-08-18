/**
 * /api/ai/coach 路由测试：会话列表、历史消息、删除会话、多轮对话与工具调用
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

describe('GET /api/ai/coach/sessions 会话列表', () => {
  it('空库返回空数组', async () => {
    const res = await app.request('/api/ai/coach/sessions', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toEqual([]);
  });

  it('返回会话摘要（首问、消息数、最后活跃）', async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO ai_messages (session_id, role, content, created_at) VALUES ('s1', 'user', '今天怎么练？', unixepoch())"),
      env.DB.prepare("INSERT INTO ai_messages (session_id, role, content, created_at) VALUES ('s1', 'assistant', '建议高踏频有氧。', unixepoch() + 1)"),
      env.DB.prepare("INSERT INTO ai_messages (session_id, role, content, created_at) VALUES ('s2', 'user', '膝盖有点酸', unixepoch() + 2)"),
    ]);
    const res = await app.request('/api/ai/coach/sessions', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions).toHaveLength(2);
    const s1 = body.sessions.find((s: any) => s.session_id === 's1');
    expect(s1.message_count).toBe(2);
    expect(s1.first_question).toBe('今天怎么练？');
  });
});

describe('GET /api/ai/coach/:session/messages 历史消息', () => {
  it('返回该会话 user/assistant 消息', async () => {
    await env.DB.batch([
      env.DB.prepare("INSERT INTO ai_messages (session_id, role, content, created_at) VALUES ('s1', 'user', '你好', unixepoch())"),
      env.DB.prepare("INSERT INTO ai_messages (session_id, role, content, created_at) VALUES ('s1', 'assistant', '我是你的教练', unixepoch() + 1)"),
      // tool 消息不应出现在该接口返回中
      env.DB.prepare(`INSERT INTO ai_messages (session_id, role, content, created_at) VALUES ('s1', 'tool', '{"ok":1}', unixepoch() + 2)`),
    ]);
    const res = await app.request('/api/ai/coach/s1/messages', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.messages).toHaveLength(2);
  });
});

describe('DELETE /api/ai/coach/:session 删除会话', () => {
  it('删除后历史清空', async () => {
    await env.DB.prepare("INSERT INTO ai_messages (session_id, role, content) VALUES ('s1', 'user', 'x')").run();
    const res = await app.request('/api/ai/coach/s1', { method: 'DELETE' }, env.env);
    expect(res.status).toBe(200);
    const rows = await env.DB.prepare("SELECT * FROM ai_messages WHERE session_id = 's1'").all<any>();
    expect(rows.results).toHaveLength(0);
  });
});

describe('POST /api/ai/coach/:session/chat 多轮对话', () => {
  it('缺少 message 返回 400', async () => {
    const res = await app.request(
      '/api/ai/coach/s1/chat',
      { method: 'POST', body: JSON.stringify({}), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(400);
  });

  it('简单回复：返回 reply 并持久化 user/assistant 消息', async () => {
    const { calls } = mockAiFetch({ content: '今天建议进行 60 分钟高踏频有氧训练。' });
    const res = await app.request(
      '/api/ai/coach/s1/chat',
      { method: 'POST', body: JSON.stringify({ message: '今天练什么' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toContain('高踏频');
    expect(body.toolCalls).toEqual([]);
    expect(calls).toHaveLength(1);

    const rows = await env.DB.prepare("SELECT role, content FROM ai_messages WHERE session_id = 's1' ORDER BY id").all<any>();
    expect(rows.results).toHaveLength(2);
    expect(rows.results[0]).toMatchObject({ role: 'user', content: '今天练什么' });
    expect(rows.results[1].role).toBe('assistant');
  });

  it('调用 calculate_cycling_kinematics 工具：执行确定性物理计算并持久化 tool 消息', async () => {
    mockAiFetch({
      sequence: [
        {
          toolCalls: [{
            id: 'call_gear',
            type: 'function',
            function: {
              name: 'calculate_cycling_kinematics',
              arguments: JSON.stringify({ operation: 'gear_cadence_speed', chainring: 46, cogs: [11, 13, 15, 17, 19, 21, 24, 28], wheelSpec: '20x2.0', cadenceRpm: 90 }),
            },
          }],
        },
        { content: '根据计算，90rpm 时 46/11 档时速约 47.5 km/h。' },
      ],
    });
    const res = await app.request(
      '/api/ai/coach/s1/chat',
      { method: 'POST', body: JSON.stringify({ message: '帮我算一下 90 踏频 46/11 的时速' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.toolCalls).toHaveLength(1);
    expect(body.toolCalls[0].function.name).toBe('calculate_cycling_kinematics');
    expect(body.reply).toContain('47.5');

    // 检查 tool 消息已落库
    const toolRows = await env.DB.prepare("SELECT role, name FROM ai_messages WHERE session_id = 's1' AND role = 'tool'").all<any>();
    expect(toolRows.results).toHaveLength(1);
    expect(toolRows.results[0].name).toBe('calculate_cycling_kinematics');
  });

  it('调用 query_rides_summary 工具：读取真实数据库统计', async () => {
    await env.DB.prepare(
      `INSERT INTO rides (id, title, start_time, end_time, elapsed_time_seconds, moving_time_seconds, distance_meters, total_ascent_meters, start_lat, created_at)
       VALUES ('r1', '测试', 1700000000000, 1700003600000, 3600, 3300, 20000, 180, 23.1, 1700000000000)`
    ).run();
    mockAiFetch({
      sequence: [
        {
          toolCalls: [{
            id: 'call_q',
            type: 'function',
            function: { name: 'query_rides_summary', arguments: JSON.stringify({ city: '广州' }) },
          }],
        },
        { content: '查询到共 1 次骑行。' },
      ],
    });
    const res = await app.request(
      '/api/ai/coach/s1/chat',
      { method: 'POST', body: JSON.stringify({ message: '看看我的骑行统计' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.toolCalls).toHaveLength(1);
    expect(body.reply).toBe('查询到共 1 次骑行。');
  });

  it('调用 set_training_goals 工具：写入训练目标并返回 goalUpdated', async () => {
    mockAiFetch({
      sequence: [
        {
          toolCalls: [{
            id: 'call_g',
            type: 'function',
            function: {
              name: 'set_training_goals',
              arguments: JSON.stringify({ primary_goal: '提升巡航均速至 22km/h', weekly_distance_km: 80, target_avg_speed_kmh: 22, monthly_distance_km: 240 }),
            },
          }],
        },
        { content: '已为你设定新的训练目标。' },
      ],
    });
    const res = await app.request(
      '/api/ai/coach/s1/chat',
      { method: 'POST', body: JSON.stringify({ message: '帮我提升训练目标' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goalUpdated).toMatchObject({ weekly_distance_km: 80, target_avg_speed_kmh: 22 });
    const goals = await env.DB.prepare('SELECT weekly_distance_km, target_avg_speed_kmh FROM training_goals WHERE id = 1').first<any>();
    expect(goals.weekly_distance_km).toBe(80);
    // primary_goal 联动写入档案
    const profile = await env.DB.prepare('SELECT primary_goal FROM rider_profile WHERE id = 1').first<any>();
    expect(profile.primary_goal).toBe('提升巡航均速至 22km/h');
    // 里程碑记录
    const milestones = await env.DB.prepare('SELECT * FROM goal_milestones').all<any>();
    expect(milestones.results.length).toBeGreaterThan(0);
  });

  it('AI 上游错误时返回可读错误信息', async () => {
    mockAiFetch({ httpStatus: 500 });
    const res = await app.request(
      '/api/ai/coach/s1/chat',
      { method: 'POST', body: JSON.stringify({ message: '你好' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reply).toContain('HTTP 500');
  });
});

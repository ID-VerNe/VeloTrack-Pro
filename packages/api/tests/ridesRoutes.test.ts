/**
 * /api/rides 路由测试：列表、单次详情、标题更新
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import app from '../src/index';
import { createTestEnv, disposeMiniflare, resetDb, type TestEnv } from './helpers/testEnv';

let env: TestEnv;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await disposeMiniflare();
});

beforeEach(async () => {
  await resetDb(env.DB);
  // 预置一条骑行记录
  await env.DB.prepare(
    `INSERT INTO rides (id, title, start_time, end_time, elapsed_time_seconds, moving_time_seconds, distance_meters, avg_speed_kmh, max_speed_kmh, total_ascent_meters, created_at)
     VALUES ('ride-001', '测试骑行', 1700000000000, 1700003600000, 3600, 3300, 20000, 21.8, 45.2, 180, 1700000000000)`
  ).run();
});

describe('GET /api/rides 列表', () => {
  it('返回全部骑行记录，包含核心字段', async () => {
    const res = await app.request('/api/rides', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rides).toHaveLength(1);
    expect(body.rides[0]).toMatchObject({
      id: 'ride-001',
      title: '测试骑行',
      distance_meters: 20000,
    });
  });

  it('空库返回空数组', async () => {
    await env.DB.prepare('DELETE FROM rides').run();
    const res = await app.request('/api/rides', { method: 'GET' }, env.env);
    const body = await res.json();
    expect(body.rides).toEqual([]);
  });
});

describe('GET /api/rides/:id 详情', () => {
  it('存在时返回完整记录', async () => {
    const res = await app.request('/api/rides/ride-001', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ride.id).toBe('ride-001');
    expect(body.ride.title).toBe('测试骑行');
    expect(body.ride.distance_meters).toBe(20000);
  });

  it('不存在时返回 404', async () => {
    const res = await app.request('/api/rides/nonexistent', { method: 'GET' }, env.env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Ride not found' });
  });
});

describe('PATCH /api/rides/:id 更新标题', () => {
  it('合法标题更新成功', async () => {
    const res = await app.request(
      '/api/rides/ride-001',
      { method: 'PATCH', body: JSON.stringify({ title: '  环千岛湖  ' }), headers: { 'Content-Type': 'application/json' } },
      env.env
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, title: '环千岛湖' });
  });

  it('空标题返回 400', async () => {
    const res = await app.request(
      '/api/rides/ride-001',
      { method: 'PATCH', body: JSON.stringify({ title: '   ' }), headers: { 'Content-Type': 'application/json' } },
      env.env
    );
    expect(res.status).toBe(400);
  });

  it('缺少 title 返回 400', async () => {
    const res = await app.request(
      '/api/rides/ride-001',
      { method: 'PATCH', body: JSON.stringify({}), headers: { 'Content-Type': 'application/json' } },
      env.env
    );
    expect(res.status).toBe(400);
  });

  it('非法 JSON body 返回 500（由统一错误处理兜底）', async () => {
    const res = await app.request(
      '/api/rides/ride-001',
      { method: 'PATCH', body: 'not-json', headers: { 'Content-Type': 'application/json' } },
      env.env
    );
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/rides/:id 删除记录', () => {
  it('存在时删除成功并返回 success 与 id', async () => {
    const res = await app.request('/api/rides/ride-001', { method: 'DELETE' }, env.env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, id: 'ride-001' });

    // 确认已从数据库删除
    const check = await env.DB.prepare('SELECT id FROM rides WHERE id = ?').bind('ride-001').first();
    expect(check).toBeNull();
  });

  it('级联清理关联的 R2 文件（detail_points 与 raw_tcx）', async () => {
    // 写入 R2 模拟文件并更新 DB 引用
    await env.BUCKET.put('rides/ride-001.json', JSON.stringify({ v: 1, points: [] }));
    await env.BUCKET.put('rides/ride-001.tcx', '<TrainingCenterDatabase />');
    await env.DB.prepare(
      "UPDATE rides SET detail_points_r2_key = 'rides/ride-001.json', raw_tcx_r2_key = 'rides/ride-001.tcx' WHERE id = 'ride-001'"
    ).run();

    const res = await app.request('/api/rides/ride-001', { method: 'DELETE' }, env.env);
    expect(res.status).toBe(200);

    // 确认 R2 中的对象已被清理
    const r2Detail = await env.BUCKET.get('rides/ride-001.json');
    const r2Tcx = await env.BUCKET.get('rides/ride-001.tcx');
    expect(r2Detail).toBeNull();
    expect(r2Tcx).toBeNull();
  });

  it('不存在时返回 404', async () => {
    const res = await app.request('/api/rides/nonexistent', { method: 'DELETE' }, env.env);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Ride not found' });
  });
});


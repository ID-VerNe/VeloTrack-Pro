/**
 * /api/admin 路由测试：隐私区域 CRUD、骑行记录 upsert、R2 大文件上传
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import app from '../src/index';
import { createTestEnv, disposeMiniflare, resetDb, type TestEnv } from './helpers/testEnv';

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

describe('隐私区域 privacy-zones', () => {
  const validZone = { id: 'home', name: '家', latitude: 23.1291, longitude: 113.2644, radius_meters: 500 };

  it('POST 新增隐私区域成功', async () => {
    const res = await app.request(
      '/api/admin/privacy-zones',
      { method: 'POST', body: JSON.stringify(validZone), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    const { results } = await env.DB.prepare('SELECT * FROM privacy_zones').all<any>();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 'home', name: '家', radius_meters: 500 });
  });

  it('POST 同 id 重复提交执行更新而非新增', async () => {
    for (let i = 0; i < 2; i++) {
      await app.request(
        '/api/admin/privacy-zones',
        { method: 'POST', body: JSON.stringify({ ...validZone, radius_meters: 500 + i }), headers: jsonHeaders },
        env.env
      );
    }
    const { results } = await env.DB.prepare('SELECT * FROM privacy_zones').all<any>();
    expect(results).toHaveLength(1);
    expect(results[0].radius_meters).toBe(501);
  });

  it('缺少 id/name 返回 400', async () => {
    for (const bad of [{ name: '家', latitude: 23, longitude: 113, radius_meters: 500 }, { id: 'x', latitude: 23, longitude: 113, radius_meters: 500 }]) {
      const res = await app.request(
        '/api/admin/privacy-zones',
        { method: 'POST', body: JSON.stringify(bad), headers: jsonHeaders },
        env.env
      );
      expect(res.status).toBe(400);
    }
  });

  it('非法坐标/半径返回 400（纬度越界、半径非正、半径超上限）', async () => {
    const cases = [
      { ...validZone, latitude: 91 },
      { ...validZone, latitude: -91 },
      { ...validZone, longitude: 181 },
      { ...validZone, radius_meters: 0 },
      { ...validZone, radius_meters: -5 },
      { ...validZone, radius_meters: 20000 },
      { ...validZone, latitude: 'abc' },
    ];
    for (const bad of cases) {
      const res = await app.request(
        '/api/admin/privacy-zones',
        { method: 'POST', body: JSON.stringify(bad), headers: jsonHeaders },
        env.env
      );
      expect(res.status).toBe(400);
    }
  });

  it('GET 返回全部隐私区域', async () => {
    await app.request(
      '/api/admin/privacy-zones',
      { method: 'POST', body: JSON.stringify(validZone), headers: jsonHeaders },
      env.env
    );
    const res = await app.request('/api/admin/privacy-zones', { method: 'GET' }, env.env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.zones).toHaveLength(1);
    expect(body.zones[0].name).toBe('家');
  });
});

describe('POST /api/admin/rides 骑行记录 upsert', () => {
  const ride = {
    id: 'ride-a',
    title: '晨骑',
    start_time: 1700000000000,
    end_time: 1700003600000,
    elapsed_time_seconds: 3600,
    moving_time_seconds: 3300,
    distance_meters: 20000,
    avg_speed_kmh: 21.8,
    max_speed_kmh: 45.2,
    total_ascent_meters: 180,
    calories: 500,
    summary_polyline: 'encoded_polyline',
  };

  it('插入完整骑行记录成功', async () => {
    const res = await app.request(
      '/api/admin/rides',
      { method: 'POST', body: JSON.stringify(ride), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const { results } = await env.DB.prepare('SELECT * FROM rides').all<any>();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 'ride-a', title: '晨骑', summary_polyline: 'encoded_polyline' });
  });

  it('缺少 id 返回 400', async () => {
    const { id, ...rest } = ride;
    const res = await app.request(
      '/api/admin/rides',
      { method: 'POST', body: JSON.stringify(rest), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(400);
  });

  it('start_time 非法返回 400', async () => {
    const res = await app.request(
      '/api/admin/rides',
      { method: 'POST', body: JSON.stringify({ ...ride, start_time: 0 }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(400);
  });

  it('未提供 title 时自动生成默认标题', async () => {
    const { title, ...rest } = ride;
    const res = await app.request(
      '/api/admin/rides',
      { method: 'POST', body: JSON.stringify(rest), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(200);
    const row = await env.DB.prepare('SELECT title FROM rides WHERE id = ?').bind('ride-a').first<any>();
    expect(row.title).toContain('骑行');
  });

  it('重传不覆盖用户已修改的 title（upsert 保留 title/created_at）', async () => {
    // 先插入
    await app.request('/api/admin/rides', { method: 'POST', body: JSON.stringify(ride), headers: jsonHeaders }, env.env);
    // 用户改名
    await env.DB.prepare('UPDATE rides SET title = ? WHERE id = ?').bind('用户改的名', 'ride-a').run();
    // 重传同 id 不同 title
    await app.request(
      '/api/admin/rides',
      { method: 'POST', body: JSON.stringify({ ...ride, title: '自动新标题', distance_meters: 99999 }), headers: jsonHeaders },
      env.env
    );
    const row = await env.DB.prepare('SELECT title, distance_meters FROM rides WHERE id = ?').bind('ride-a').first<any>();
    expect(row.title).toBe('用户改的名');
    expect(row.distance_meters).toBe(99999); // 统计字段被更新
  });

  it('超大数值被钳制到安全范围', async () => {
    await app.request(
      '/api/admin/rides',
      { method: 'POST', body: JSON.stringify({ ...ride, max_speed_kmh: 99999 }), headers: jsonHeaders },
      env.env
    );
    const row = await env.DB.prepare('SELECT max_speed_kmh FROM rides WHERE id = ?').bind('ride-a').first<any>();
    expect(row.max_speed_kmh).toBeLessThanOrEqual(1e10);
  });
});

describe('POST /api/admin/upload-file R2 上传', () => {
  it('合法 key 与 content-type 上传成功', async () => {
    const file = new File(['<xml/>'], 'ride.tcx', { type: 'application/xml' });
    const form = new FormData();
    form.append('file', file);
    form.append('key', 'rides/2024-01-01.tcx');
    const res = await app.request('/api/admin/upload-file', { method: 'POST', body: form }, env.env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, key: 'rides/2024-01-01.tcx' });

    const stored = await env.BUCKET.get('rides/2024-01-01.tcx');
    expect(stored).not.toBeNull();
  });

  it('非 File 数据返回 400', async () => {
    const res = await app.request(
      '/api/admin/upload-file',
      { method: 'POST', body: JSON.stringify({ key: 'rides/x.tcx' }), headers: jsonHeaders },
      env.env
    );
    expect(res.status).toBe(400);
  });

  it('key 不匹配白名单格式返回 400', async () => {
    const file = new File(['x'], 'a.tcx');
    const form = new FormData();
    form.append('file', file);
    form.append('key', 'not-a-valid-key');
    const res = await app.request('/api/admin/upload-file', { method: 'POST', body: form }, env.env);
    expect(res.status).toBe(400);
  });

  it('非白名单 content-type 返回 415', async () => {
    const file = new File(['x'], 'a.tcx', { type: 'text/html' });
    const form = new FormData();
    form.append('file', file);
    form.append('key', 'rides/a.tcx');
    const res = await app.request('/api/admin/upload-file', { method: 'POST', body: form }, env.env);
    expect(res.status).toBe(415);
  });

  it('超过 20MB 上限返回 413', async () => {
    // File 对象的 size 由 Blob 内容决定，构造 21MB Blob
    const big = new Blob([new Uint8Array(21 * 1024 * 1024)]);
    const file = new File([big], 'big.tcx', { type: 'application/xml' });
    const form = new FormData();
    form.append('file', file);
    form.append('key', 'rides/big.tcx');
    const res = await app.request('/api/admin/upload-file', { method: 'POST', body: form }, env.env);
    expect(res.status).toBe(413);
  });
});

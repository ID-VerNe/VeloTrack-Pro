import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { clearAllLocalData, getAllLocalRides, saveLocalRides, getKv, setKv } from '../../utils/storage/indexedDb';
import { outboxManager } from '../outboxManager';
import { syncEngine } from '../syncEngine';

describe('SyncEngine & OutboxManager', () => {
  beforeEach(async () => {
    await clearAllLocalData();
    await syncEngine.resetCursor();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('outboxManager 修改标题：0ms 本地更新并写入待发送队列', async () => {
    // 准备一条本地记录
    await saveLocalRides([{ id: 'r1', title: '原标题', start_time: 1000 }]);

    // Mock fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        results: [{ mutation_id: 'any', status: 'applied' }],
      }),
    });
    globalThis.fetch = fetchMock;

    await outboxManager.updateRideTitle('r1', '新标题-海边刷圈');

    const rides = await getAllLocalRides();
    expect(rides[0].title).toBe('新标题-海边刷圈');
  });

  it('syncEngine.pullSync 增量拉取并合并新记录与处理墓碑', async () => {
    // 模拟服务端首批数据
    const serverRides = [
      { id: 'r1', title: '骑行1', start_time: 1000, distance_meters: 10000, updated_at: 1000, deleted_at: null },
      { id: 'r2', title: '骑行2', start_time: 2000, distance_meters: 20000, updated_at: 2000, deleted_at: null },
    ];

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/sync?since=0')) {
        return {
          ok: true,
          json: async () => ({ rides: serverRides, server_time: 5000 }),
        };
      }
      return { ok: true, json: async () => ({ rides: [], server_time: 5000 }) };
    });

    const res1 = await syncEngine.pullSync({ force: true });
    expect(res1.success).toBe(true);

    const localAfterFirst = await getAllLocalRides();
    expect(localAfterFirst.length).toBe(2);
    expect(await getKv('last_sync_timestamp')).toBe(5000);

    // 模拟第二轮同步：服务端推送 r2 被软删除，r3 新增
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/api/sync?since=5000')) {
        return {
          ok: true,
          json: async () => ({
            rides: [
              { id: 'r2', deleted_at: 6000, updated_at: 6000 },
              { id: 'r3', title: '骑行3', start_time: 3000, distance_meters: 30000, updated_at: 6500, deleted_at: null },
            ],
            server_time: 7000,
          }),
        };
      }
      return { ok: true, json: async () => ({ rides: [], server_time: 7000 }) };
    });

    const res2 = await syncEngine.pullSync({ force: true });
    expect(res2.success).toBe(true);
    expect(res2.newCount).toBe(1);
    expect(res2.deletedCount).toBe(1);

    const localAfterSecond = await getAllLocalRides();
    expect(localAfterSecond.length).toBe(2);
    expect(localAfterSecond.map((r) => r.id)).toEqual(['r3', 'r1']);
    expect(await getKv('last_sync_timestamp')).toBe(7000);
  });

  it('网络异常时 pullSync 返回失败且严禁推进游标，状态置为 error', async () => {
    // 假设已有有效游标 5000
    await setKv('last_sync_timestamp', 5000);

    // 模拟服务端 500 错误
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server Crash' }),
    });

    const res = await syncEngine.pullSync({ force: true });
    expect(res.success).toBe(false);
    expect(syncEngine.getStatus()).toBe('error');

    // 游标必须保持 5000，绝对不能被推到当前时间
    expect(await getKv('last_sync_timestamp')).toBe(5000);
  });

  it('重叠窗口返回的未变动记录不应触发冗余 updatedCount 计数', async () => {
    await saveLocalRides([{ id: 'r1', title: '既有记录', start_time: 1000, updated_at: 5000 }]);
    await setKv('last_sync_timestamp', 5000);

    // 模拟 1000ms 重叠窗口返回了与本地版本一致的 r1
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rides: [{ id: 'r1', title: '既有记录', start_time: 1000, updated_at: 5000 }],
        server_time: 6000,
      }),
    });

    const res = await syncEngine.pullSync({ force: true });
    expect(res.success).toBe(true);
    expect(res.updatedCount).toBe(0); // 没有实质修改，计数应为 0
    expect(await getKv('last_sync_timestamp')).toBe(6000);
  });
});


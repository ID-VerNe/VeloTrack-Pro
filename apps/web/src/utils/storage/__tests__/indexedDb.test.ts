import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  openDb,
  saveLocalRides,
  getAllLocalRides,
  deleteLocalRide,
  updateLocalRideTitle,
  getLocalRideDetail,
  saveLocalRideDetail,
  enqueueMutation,
  getPendingMutations,
  removeMutation,
  setKv,
  getKv,
  clearAllLocalData,
} from '../indexedDb';

describe('indexedDb storage client', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it('成功打开并初始化数据库与四个 objectStore', async () => {
    const db = await openDb();
    expect(db.objectStoreNames.contains('rides')).toBe(true);
    expect(db.objectStoreNames.contains('ride_details')).toBe(true);
    expect(db.objectStoreNames.contains('mutation_queue')).toBe(true);
    expect(db.objectStoreNames.contains('kv_store')).toBe(true);
  });

  it('支持保存与按 start_time 倒序查询骑行列表', async () => {
    const mockRides = [
      { id: 'ride-1', title: '骑行1', start_time: 1000, distance_meters: 5000 },
      { id: 'ride-2', title: '骑行2', start_time: 3000, distance_meters: 15000 },
      { id: 'ride-3', title: '骑行3', start_time: 2000, distance_meters: 10000 },
    ];

    await saveLocalRides(mockRides);
    const list = await getAllLocalRides();
    expect(list.length).toBe(3);
    // 验证按 start_time 倒序：ride-2 (3000) -> ride-3 (2000) -> ride-1 (1000)
    expect(list[0].id).toBe('ride-2');
    expect(list[1].id).toBe('ride-3');
    expect(list[2].id).toBe('ride-1');
  });

  it('支持保存与读取不可变详情与轨迹点', async () => {
    const detailPoints = [
      { lat: 22.5, lng: 113.9, time: 1000, speed: 25.5, alt: 10 },
      { lat: 22.51, lng: 113.91, time: 1005, speed: 26.0, alt: 12 },
    ];
    const ride = { id: 'ride-detail-1', title: '海滨骑行', start_time: 5000 };

    await saveLocalRideDetail('ride-detail-1', ride, detailPoints);

    const cached = await getLocalRideDetail('ride-detail-1');
    expect(cached).not.toBeNull();
    expect(cached?.ride.title).toBe('海滨骑行');
    expect(cached?.detailPoints?.length).toBe(2);

    // 未保存的返回 null
    const nonExistent = await getLocalRideDetail('non-existent');
    expect(nonExistent).toBeNull();
  });

  it('支持局部修改标题，同时同步列表与详情缓存', async () => {
    const ride = { id: 'ride-10', title: '原标题', start_time: 2000 };
    await saveLocalRides([ride]);
    await saveLocalRideDetail('ride-10', ride, [{ lat: 1, lng: 2 }]);

    const updateTime = 1726738900000;
    await updateLocalRideTitle('ride-10', '新标题-大学城破风', updateTime);

    const list = await getAllLocalRides();
    expect(list.find((r) => r.id === 'ride-10')?.title).toBe('新标题-大学城破风');
    expect(list.find((r) => r.id === 'ride-10')?.updated_at).toBe(updateTime);

    const detail = await getLocalRideDetail('ride-10');
    expect(detail?.ride.title).toBe('新标题-大学城破风');
  });

  it('支持本地删除，同时级联清除列表与详情', async () => {
    await saveLocalRides([{ id: 'ride-del', title: '待删除', start_time: 1000 }]);
    await saveLocalRideDetail('ride-del', { id: 'ride-del', title: '待删除' }, []);

    await deleteLocalRide('ride-del');

    const list = await getAllLocalRides();
    expect(list.find((r) => r.id === 'ride-del')).toBeUndefined();

    const detail = await getLocalRideDetail('ride-del');
    expect(detail).toBeNull();
  });

  it('离线发件箱 Outbox：入队、按时间排序读取、消费后移除', async () => {
    const mId1 = await enqueueMutation('UPDATE_TITLE', { id: 'r1', title: '标题1' });
    const mId2 = await enqueueMutation('DELETE_RIDE', { id: 'r2' });

    const pending = await getPendingMutations();
    expect(pending.length).toBe(2);
    expect(pending[0].mutation_id).toBe(mId1);
    expect(pending[1].mutation_id).toBe(mId2);

    await removeMutation(mId1);
    const after = await getPendingMutations();
    expect(after.length).toBe(1);
    expect(after[0].mutation_id).toBe(mId2);
  });

  it('KV Store 支持设置与读取高水位游标', async () => {
    expect(await getKv('last_sync_timestamp')).toBeNull();

    await setKv('last_sync_timestamp', 1726738900000);
    expect(await getKv('last_sync_timestamp')).toBe(1726738900000);
  });
});

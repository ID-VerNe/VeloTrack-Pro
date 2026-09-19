// apps/web/src/utils/storage/indexedDb.ts
//
// 纯原生 Promise 封装的 IndexedDB 客户端：
// 1. rides: 骑行列表缓存（支持 start_time 索引排序）
// 2. ride_details: 骑行详情与不可变 GPS 时序点缓存（终生免重复请求）
// 3. mutation_queue: 离线发件箱队列（断网写操作 0ms 压栈）
// 4. kv_store: 键值存储（如 last_sync_timestamp 高水位线游标）

const DB_NAME = 'velotrack_local_db';
const DB_VERSION = 1;

export interface OutboxMutation {
  mutation_id: string;
  action: 'UPDATE_TITLE' | 'DELETE_RIDE' | string;
  payload: Record<string, any>;
  status: 'pending' | 'syncing' | 'failed';
  created_at: number;
  retry_count: number;
}

export interface CachedRideDetail {
  id: string;
  ride: any;
  detailPoints: any[] | null;
  cached_at: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function isIndexedDbAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
}

export function openDb(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error('IndexedDB is not available in current environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. rides 列表
        if (!db.objectStoreNames.contains('rides')) {
          const store = db.createObjectStore('rides', { keyPath: 'id' });
          store.createIndex('start_time', 'start_time', { unique: false });
          store.createIndex('updated_at', 'updated_at', { unique: false });
        }

        // 2. ride_details 详情与不可变轨迹点
        if (!db.objectStoreNames.contains('ride_details')) {
          db.createObjectStore('ride_details', { keyPath: 'id' });
        }

        // 3. mutation_queue 离线发件箱
        if (!db.objectStoreNames.contains('mutation_queue')) {
          const store = db.createObjectStore('mutation_queue', { keyPath: 'mutation_id' });
          store.createIndex('created_at', 'created_at', { unique: false });
        }

        // 4. kv_store 状态与游标
        if (!db.objectStoreNames.contains('kv_store')) {
          db.createObjectStore('kv_store', { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error || new Error('Failed to open IndexedDB'));
      };

      request.onblocked = () => {
        console.warn('[IndexedDB] Database open blocked by another tab');
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

// ---------------------------------------------------------------------------
// 1. rides 列表 CRUD
// ---------------------------------------------------------------------------

export async function getAllLocalRides(): Promise<any[]> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('rides', 'readonly');
      const store = tx.objectStore('rides');
      const index = store.index('start_time');
      const req = index.openCursor(null, 'prev'); // 按 start_time 倒序
      const list: any[] = [];

      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor) {
          list.push(cursor.value);
          cursor.continue();
        } else {
          resolve(list);
        }
      };

      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveLocalRides(rides: any[]): Promise<void> {
  if (!rides || !rides.length) return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('rides', 'readwrite');
      const store = tx.objectStore('rides');

      for (const r of rides) {
        if (r && r.id) {
          store.put(r);
        }
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to save rides:', err);
  }
}

export async function deleteLocalRide(id: string): Promise<void> {
  if (!id) return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['rides', 'ride_details'], 'readwrite');
      tx.objectStore('rides').delete(id);
      tx.objectStore('ride_details').delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to delete ride:', err);
  }
}

export async function updateLocalRideTitle(id: string, newTitle: string, clientUpdatedAt: number): Promise<void> {
  if (!id) return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['rides', 'ride_details'], 'readwrite');
      const rideStore = tx.objectStore('rides');
      const getReq = rideStore.get(id);

      getReq.onsuccess = () => {
        const current = getReq.result;
        if (current) {
          current.title = newTitle;
          current.updated_at = clientUpdatedAt;
          rideStore.put(current);
        }
      };

      // 同时更新详情中的标题（若存在）
      const detailStore = tx.objectStore('ride_details');
      const detailReq = detailStore.get(id);
      detailReq.onsuccess = () => {
        const item = detailReq.result;
        if (item && item.ride) {
          item.ride.title = newTitle;
          item.ride.updated_at = clientUpdatedAt;
          detailStore.put(item);
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to update ride title:', err);
  }
}

// ---------------------------------------------------------------------------
// 2. ride_details 详情与不可变轨迹点
// ---------------------------------------------------------------------------

export async function getLocalRideDetail(id: string): Promise<{ ride: any; detailPoints: any[] | null } | null> {
  if (!id) return null;
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('ride_details', 'readonly');
      const req = tx.objectStore('ride_details').get(id);

      req.onsuccess = () => {
        const data = req.result as CachedRideDetail | undefined;
        if (data && data.ride) {
          resolve({ ride: data.ride, detailPoints: data.detailPoints });
        } else {
          resolve(null);
        }
      };

      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveLocalRideDetail(id: string, ride: any, detailPoints: any[] | null): Promise<void> {
  if (!id || !ride) return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['rides', 'ride_details'], 'readwrite');

      // 沉淀详情
      const cachedItem: CachedRideDetail = {
        id,
        ride,
        detailPoints,
        cached_at: Date.now(),
      };
      tx.objectStore('ride_details').put(cachedItem);

      // 同步更新或补齐列表中的该记录摘要
      tx.objectStore('rides').put(ride);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to save ride detail:', err);
  }
}

// ---------------------------------------------------------------------------
// 3. mutation_queue 离线发件箱
// ---------------------------------------------------------------------------

let mutationCounter = 0;

function generateUUID(): string {
  const ts = Date.now().toString().padStart(15, '0');
  const seq = (mutationCounter++ % 100000).toString().padStart(6, '0');
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().substring(0, 8)
    : Math.random().toString(36).substring(2, 8);
  return `m_${ts}_${seq}_${rand}`;
}

export async function enqueueMutation(action: string, payload: Record<string, any>): Promise<string> {
  const mutation_id = generateUUID();
  const mutation: OutboxMutation = {
    mutation_id,
    action,
    payload,
    status: 'pending',
    created_at: Date.now(),
    retry_count: 0,
  };

  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('mutation_queue', 'readwrite');
      tx.objectStore('mutation_queue').put(mutation);
      tx.oncomplete = () => resolve(mutation_id);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to enqueue mutation:', err);
    return mutation_id;
  }
}

export async function getPendingMutations(): Promise<OutboxMutation[]> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('mutation_queue', 'readonly');
      const store = tx.objectStore('mutation_queue');
      const index = store.index('created_at');
      const req = index.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function removeMutation(mutationId: string): Promise<void> {
  if (!mutationId) return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('mutation_queue', 'readwrite');
      tx.objectStore('mutation_queue').delete(mutationId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to remove mutation:', err);
  }
}

export async function incrementMutationRetry(mutationId: string, maxRetries = 5): Promise<boolean> {
  if (!mutationId) return false;
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('mutation_queue', 'readwrite');
      const store = tx.objectStore('mutation_queue');
      const req = store.get(mutationId);
      req.onsuccess = () => {
        const item = req.result as OutboxMutation | undefined;
        if (!item) {
          resolve(false);
          return;
        }
        item.retry_count = (item.retry_count || 0) + 1;
        if (item.retry_count >= maxRetries) {
          console.warn(`[Outbox] Mutation ${mutationId} 超出最大重试次数(${maxRetries})，已安全移除防死循环`);
          store.delete(mutationId);
          resolve(false);
        } else {
          store.put(item);
          resolve(true);
        }
      };
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

export async function clearMutationQueue(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('mutation_queue', 'readwrite');
      tx.objectStore('mutation_queue').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// 4. kv_store 标量存储 (高水位线游标等)
// ---------------------------------------------------------------------------

export async function getKv<T = any>(key: string): Promise<T | null> {
  if (!key) return null;
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction('kv_store', 'readonly');
      const req = tx.objectStore('kv_store').get(key);
      req.onsuccess = () => {
        resolve(req.result ? req.result.value : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function setKv(key: string, value: any): Promise<void> {
  if (!key) return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('kv_store', 'readwrite');
      tx.objectStore('kv_store').put({ key, value, updated_at: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`[IndexedDB] Failed to set KV ${key}:`, err);
  }
}

// ---------------------------------------------------------------------------
// 5. 重置与全量清理
// ---------------------------------------------------------------------------

export async function clearAllLocalData(): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['rides', 'ride_details', 'mutation_queue', 'kv_store'], 'readwrite');
      tx.objectStore('rides').clear();
      tx.objectStore('ride_details').clear();
      tx.objectStore('mutation_queue').clear();
      tx.objectStore('kv_store').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Failed to clear local data:', err);
  }
}

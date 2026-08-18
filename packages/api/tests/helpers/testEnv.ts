/**
 * API 集成测试环境（Miniflare 真实 D1/R2）
 *
 * 策略：
 * - 每个测试文件内共享一个 Miniflare 实例（workerd 子进程），启动一次即复用
 * - 应用 schema.sql 初始化 rides / privacy_zones 表；其余表由 dbInit.ensureTables 按需创建
 * - 通过 Hono app.request(path, init, env) 注入 DB/BUCKET/ADMIN_TOKEN 进行进程内测试
 */
import { Miniflare } from 'miniflare';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface TestEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  env: { DB: D1Database; BUCKET: R2Bucket; ADMIN_TOKEN?: string; AI_API_KEY?: string };
  mf: Miniflare;
}

let sharedMf: Miniflare | null = null;

function getSharedMiniflare(): Miniflare {
  if (!sharedMf) {
    sharedMf = new Miniflare({
      modules: true,
      // 最小 worker 脚本（仅用于承载 D1/R2 绑定，路由测试不走 workerd，直接调 Hono）
      script: 'export default { fetch() { return new Response("ok") } }',
      d1Databases: ['DB'],
      r2Buckets: ['BUCKET'],
      // 内存态数据库：测试间状态由 resetDb 清理，避免落盘污染
      d1Persist: false,
    });
  }
  return sharedMf;
}

/** 创建/复用测试环境，并保证核心表存在 */
export async function createTestEnv(token?: string, aiApiKey?: string): Promise<TestEnv> {
  const mf = getSharedMiniflare();
  const DB = await mf.getD1Database('DB');
  const BUCKET = await mf.getR2Bucket('BUCKET');

  // 首次初始化：执行 schema.sql 建 rides / privacy_zones 表（dbInit 不负责这两张表）
  const meta = await DB.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='rides'"
  ).first<any>();
  if (!meta) {
    const schema = readFileSync(resolve(__dirname, '../../schema.sql'), 'utf-8');
    // Miniflare exec 不识别注释与语句内换行：剔除 `--` 注释，折叠为单行，按分号拆分逐条执行
    const statements = schema
      .split('\n')
      .map((line) => {
        const idx = line.indexOf('--');
        return idx >= 0 ? line.slice(0, idx) : line;
      })
      .join(' ')
      .replace(/\s+/g, ' ')
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await DB.exec(stmt);
    }
  }

  const env = {
    DB,
    BUCKET,
    ...(token !== undefined ? { ADMIN_TOKEN: token } : {}),
    ...(aiApiKey !== undefined ? { AI_API_KEY: aiApiKey } : {}),
  };

  return { DB, BUCKET, env, mf };
}

/** 清空全部业务数据，保证每个用例从干净状态开始 */
export async function resetDb(DB: D1Database): Promise<void> {
  // 集合型表直接清空
  const collectionTables = [
    'ride_insights',
    'ride_tags',
    'ai_messages',
    'rider_memories',
    'goal_milestones',
    'privacy_zones',
    'rides',
  ];
  for (const t of collectionTables) {
    try {
      await DB.prepare(`DELETE FROM ${t}`).run();
    } catch {
      // 表可能尚不存在，忽略
    }
  }

  // 单例行表（ensureTables 有模块级缓存不会重跑 INSERT OR IGNORE），手动重置为默认值
  try {
    await DB.prepare(`
      INSERT OR REPLACE INTO ai_config (id, base_url, model_name, api_key, updated_at)
      VALUES (1, '', 'deepseek-v4-flash', '', unixepoch())
    `).run();
    await DB.prepare(`
      INSERT OR REPLACE INTO rider_profile (id, name, gender, weight_kg, height_cm, max_hr, resting_hr, ftp_watts, current_bike, gear_ratio, tires, bike_weight_kg, bike_specs, custom_specs, injuries_notes, primary_goal, updated_at)
      VALUES (1, 'VerNe Yuu', 'male', 75.0, 173.0, 188, 55, 165, '大行 P8', '46T牙盘 + 11-28T 7速飞轮', '马牌 Contact Urban 2.0 轮胎 (75-80 psi)', 11.5, '46T牙盘 + 11-28T 7速飞轮 | 马牌 Contact Urban 2.0 轮胎', '{"pedals": "平踏", "wheelset": "20寸406"}', '右膝半月板轻微劳损史，需维持85-95rpm高踏频防护', 'W1-2稳扎16km/h均速门槛，建立高踏频肌肉记忆，向20km/h进发', unixepoch())
    `).run();
    await DB.prepare(`
      INSERT OR REPLACE INTO training_goals (id, weekly_distance_km, target_avg_speed_kmh, monthly_distance_km, annual_distance_km, coach_notes, updated_at)
      VALUES (1, 60.0, 18.0, 180.0, 1000.0, '换档至46/17T（第3档），绿灯路段锁90rpm巡航23km/h，红灯停车挂轻档准备起步。', unixepoch())
    `).run();
  } catch {
    // 表尚不存在（首次初始化前），忽略
  }
}

/** 释放 Miniflare（仅文件级 teardown 调用一次） */
export async function disposeMiniflare(): Promise<void> {
  if (sharedMf) {
    await sharedMf.dispose();
    sharedMf = null;
  }
}

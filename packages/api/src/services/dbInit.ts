// 模块级缓存：同一 Worker 实例（isolate）生命周期内只执行一次初始化，
// 避免每个请求重复执行 20+ 条 DDL 往返（原实现每请求执行，延迟放大 100-500ms）
let ensureTablesPromise: Promise<void> | null = null

export function ensureTables(db: D1Database): Promise<void> {
  if (!ensureTablesPromise) {
    ensureTablesPromise = runEnsureTables(db).catch((err) => {
      // 初始化失败时清空缓存，允许下一个请求重试，避免 isolate 永久坏态
      ensureTablesPromise = null
      throw err
    })
  }
  return ensureTablesPromise
}

async function runEnsureTables(db: D1Database) {
  // rides / privacy_zones 原本仅由 schema.sql 手动初始化，运行时空库（新部署 / 本地模拟）会缺失导致接口报错。
  // 这里与 schema.sql 保持一致补建，保证任何环境冷启动即可用。
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS rides (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER NOT NULL,
      elapsed_time_seconds INTEGER NOT NULL,
      moving_time_seconds INTEGER NOT NULL,
      distance_meters REAL NOT NULL,
      max_speed_kmh REAL,
      avg_speed_kmh REAL,
      total_ascent_meters REAL,
      total_descent_meters REAL,
      max_altitude_meters REAL,
      avg_heart_rate INTEGER,
      max_heart_rate INTEGER,
      avg_cadence INTEGER,
      max_cadence INTEGER,
      calories INTEGER,
      hr_z1_seconds INTEGER DEFAULT 0,
      hr_z2_seconds INTEGER DEFAULT 0,
      hr_z3_seconds INTEGER DEFAULT 0,
      hr_z4_seconds INTEGER DEFAULT 0,
      hr_z5_seconds INTEGER DEFAULT 0,
      start_lat REAL,
      start_lng REAL,
      summary_polyline TEXT,
      detail_points_r2_key TEXT,
      raw_tcx_r2_key TEXT,
      is_commute INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    )
  `).run();
  try { await db.prepare('CREATE INDEX IF NOT EXISTS idx_rides_start_time ON rides(start_time)').run() } catch {}

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS privacy_zones (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      radius_meters REAL DEFAULT 500
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_config (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
      base_url TEXT NOT NULL DEFAULT '',
      model_name TEXT NOT NULL DEFAULT 'deepseek-v4-flash',
      api_key TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ride_insights (
      ride_id TEXT PRIMARY KEY,
      content_hash TEXT NOT NULL,
      insight TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ride_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ride_id TEXT NOT NULL,
      tag TEXT NOT NULL,
      UNIQUE(ride_id, tag)
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'tool')),
      content TEXT,
      tool_calls TEXT,
      tool_call_id TEXT,
      name TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS rider_profile (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
      name TEXT NOT NULL DEFAULT 'VerNe Yuu',
      gender TEXT NOT NULL DEFAULT 'male',
      weight_kg REAL NOT NULL DEFAULT 75.0,
      height_cm REAL NOT NULL DEFAULT 173.0,
      max_hr INTEGER NOT NULL DEFAULT 188,
      resting_hr INTEGER NOT NULL DEFAULT 55,
      ftp_watts INTEGER NOT NULL DEFAULT 165,
      current_bike TEXT NOT NULL DEFAULT '大行 P8',
      gear_ratio TEXT DEFAULT '46T牙盘 + 11-28T 7速飞轮',
      tires TEXT DEFAULT '马牌 Contact Urban 2.0 轮胎 (75-80 psi)',
      bike_weight_kg REAL DEFAULT 11.5,
      bike_specs TEXT NOT NULL DEFAULT '46T牙盘 + 11-28T 7速飞轮 | 马牌 Contact Urban 2.0 轮胎',
      custom_specs TEXT DEFAULT '{"pedals": "平踏", "wheelset": "20寸406"}',
      injuries_notes TEXT NOT NULL DEFAULT '右膝半月板轻微劳损史，需维持85-95rpm高踏频防护',
      primary_goal TEXT NOT NULL DEFAULT 'W1-2稳扎16km/h均速门槛，建立高踏频肌肉记忆，向20km/h进发',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).run();

  // Safe incremental migration for existing databases
  try { await db.prepare('ALTER TABLE rider_profile ADD COLUMN gear_ratio TEXT').run(); } catch {}
  try { await db.prepare('ALTER TABLE rider_profile ADD COLUMN tires TEXT').run(); } catch {}
  try { await db.prepare('ALTER TABLE rider_profile ADD COLUMN bike_weight_kg REAL').run(); } catch {}
  try { await db.prepare('ALTER TABLE rider_profile ADD COLUMN custom_specs TEXT').run(); } catch {}

  // Migrate rider_memories to remove restrictive CHECK constraints and add importance
  try {
    const tableInfo = await db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='rider_memories'").first<any>();
    if (tableInfo?.sql && tableInfo.sql.includes('CHECK(category IN')) {
      await db.prepare(`
        CREATE TABLE rider_memories_v2 (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          memory_key TEXT NOT NULL,
          content TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'manual',
          importance INTEGER NOT NULL DEFAULT 3,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL DEFAULT (unixepoch()),
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `).run();

      await db.prepare(`
        INSERT INTO rider_memories_v2 (id, category, memory_key, content, source, is_active, created_at, updated_at)
        SELECT id, category, memory_key, content, source, is_active, created_at, updated_at FROM rider_memories
      `).run();

      await db.prepare('DROP TABLE rider_memories').run();
      await db.prepare('ALTER TABLE rider_memories_v2 RENAME TO rider_memories').run();
    }
  } catch (err) {
    console.error('rider_memories migration note:', err);
  }

  // L2: Semantic Profile Memories (Atomic facts)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS rider_memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      memory_key TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      importance INTEGER NOT NULL DEFAULT 3,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).run();

  try { await db.prepare('ALTER TABLE rider_memories ADD COLUMN importance INTEGER NOT NULL DEFAULT 3').run(); } catch {}

  // L3: Episodic Goal & Milestone Evolution
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS goal_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weekly_distance_km REAL NOT NULL,
      target_avg_speed_kmh REAL NOT NULL,
      monthly_distance_km REAL,
      primary_goal TEXT,
      rationale TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'coach',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).run();

  // Training Goals Table
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS training_goals (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
      weekly_distance_km REAL NOT NULL DEFAULT 60.0,
      target_avg_speed_kmh REAL NOT NULL DEFAULT 18.0,
      monthly_distance_km REAL NOT NULL DEFAULT 180.0,
      annual_distance_km REAL NOT NULL DEFAULT 1000.0,
      coach_notes TEXT DEFAULT '换档至46/17T（第3档），绿灯路段锁90rpm巡航23km/h，红灯停车挂轻档准备起步。',
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `).run();

  await db.prepare(`
    INSERT OR IGNORE INTO ai_config (id, base_url, model_name, api_key)
    VALUES (1, '', 'deepseek-v4-flash', '')
  `).run();

  await db.prepare(`
    INSERT OR IGNORE INTO rider_profile (id, name, gender, weight_kg, height_cm, max_hr, resting_hr, ftp_watts, current_bike, gear_ratio, tires, bike_weight_kg, bike_specs, custom_specs, injuries_notes, primary_goal)
    VALUES (1, 'VerNe Yuu', 'male', 75.0, 173.0, 188, 55, 165, '大行 P8', '46T牙盘 + 11-28T 7速飞轮', '马牌 Contact Urban 2.0 轮胎 (75-80 psi)', 11.5, '46T牙盘 + 11-28T 7速飞轮 | 马牌 Contact Urban 2.0 轮胎', '{"pedals": "平踏", "wheelset": "20寸406"}', '右膝半月板轻微劳损史，需维持85-95rpm高踏频防护', 'W1-2稳扎16km/h均速门槛，建立高踏频肌肉记忆，向20km/h进发')
  `).run();

  await db.prepare(`
    INSERT OR IGNORE INTO training_goals (id, weekly_distance_km, target_avg_speed_kmh, monthly_distance_km, annual_distance_km, coach_notes)
    VALUES (1, 60.0, 18.0, 180.0, 1000.0, '换档至46/17T（第3档），绿灯路段锁90rpm巡航23km/h，红灯停车挂轻档准备起步。')
  `).run();

  // One-time cleanup and migration: purge dirty paragraph dumps
  try {
    const dirtyMemories = await db.prepare(`
      SELECT id FROM rider_memories WHERE length(content) > 100 OR content LIKE '%教练根据车手近期状态主动设定新目标%'
    `).all<any>();

    if (dirtyMemories.results && dirtyMemories.results.length > 0) {
      for (const d of dirtyMemories.results) {
        await db.prepare('DELETE FROM rider_memories WHERE id = ?').bind(d.id).run();
      }
    }
  } catch {}

  // Seed standard distilled atomic facts if empty
  try {
    const countMemories = await db.prepare('SELECT COUNT(*) as count FROM rider_memories').first<any>();
    if (!countMemories || countMemories.count === 0) {
      await db.prepare(`
        INSERT INTO rider_memories (category, memory_key, content, source, importance, is_active, created_at, updated_at)
        VALUES 
          ('health', 'knee_safety_rule', '右膝半月板有劳损史，踏频低于80rpm容易酸痛，红灯起步须提前降档轻蹬，切忌大齿比重踏。', 'coach', 5, 1, unixepoch() - 86400 * 3, unixepoch()),
          ('gear', 'p8_sweetspot_gear', '大行P8巡航甜点：46x18T/17T搭配90rpm踏频（时速约20~23km/h）最顺畅省力；马牌2.0胎压维持75-80psi。', 'coach', 4, 1, unixepoch() - 86400 * 2, unixepoch()),
          ('habit', 'night_ride_preference', '骑行时段主要在夜间与傍晚，偏好照明良好、红绿灯较少的平路绿道。', 'manual', 3, 1, unixepoch() - 86400, unixepoch()),
          ('preference', 'cadence_focus_style', '训练偏好：优先打磨稳定踏频基底与 Zone 2 有氧心率，循序渐进提速，排斥激进过量。', 'coach', 4, 1, unixepoch(), unixepoch())
      `).run();
    }
  } catch {}

  // Seed initial milestone record if empty
  try {
    const countMilestones = await db.prepare('SELECT COUNT(*) as count FROM goal_milestones').first<any>();
    if (!countMilestones || countMilestones.count === 0) {
      await db.prepare(`
        INSERT INTO goal_milestones (weekly_distance_km, target_avg_speed_kmh, monthly_distance_km, primary_goal, rationale, source, created_at)
        VALUES
          (50.0, 16.0, 150.0, '基础踏频与有氧基底建立', '初始建档目标：建立85-95rpm高踏频骑行习惯', 'coach', unixepoch() - 86400 * 7),
          (60.0, 18.0, 180.0, '绿灯路段巡航提速与 Zone2 稳态输出', '根据近期实战停表均速达标，主动上调单周里程至60km与巡航均速18km/h', 'coach', unixepoch())
      `).run();
    }
  } catch {}

  // rides 表核心查询索引（rides 由 schema.sql 手动初始化，表可能尚不存在，容错处理）
  try {
    await db.prepare('CREATE INDEX IF NOT EXISTS idx_rides_start_time ON rides(start_time)').run();
  } catch {}
}

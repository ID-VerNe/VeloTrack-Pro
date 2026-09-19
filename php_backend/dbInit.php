<?php

// php_backend/dbInit.php
//
// 运行时表自举 + seed，从 packages/api/src/services/dbInit.ts 翻译而来。
// 模块级静态缓存：同一 PHP 进程生命周期内只执行一次初始化，
// 避免每个请求重复执行 DDL 往返（原 D1 实现每 isolate 首请求执行一次）。

/**
 * 确保所有表存在并完成 seed。进程级静态缓存，失败时清空允许重试。
 */
function ensure_tables(PDO $pdo): void
{
    static $done = false;
    static $errored = false;

    if ($done) return;
    if ($errored) {
        // 上次失败，不再重试同进程，避免坏态级联
        return;
    }

    try {
        run_ensure_tables($pdo);
        $done = true;
    } catch (Throwable $e) {
        $errored = true;
        error_log('[dbInit] ensureTables failed: ' . $e->getMessage());
        throw $e;
    }
}

function run_ensure_tables(PDO $pdo): void
{
    // rides 表（删 detail_points_r2_key / raw_tcx_r2_key 两列，加 detail_points TEXT 列）
    $pdo->exec("
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
            detail_points TEXT,
            city TEXT,
            cities TEXT,
            is_cross_city INTEGER DEFAULT 0,
            is_commute INTEGER DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER,
            deleted_at INTEGER
        )
    ");
    try { $pdo->exec('CREATE INDEX IF NOT EXISTS idx_rides_start_time ON rides(start_time)'); } catch (Throwable $e) {}
    try { $pdo->exec('CREATE INDEX IF NOT EXISTS idx_rides_city ON rides(city)'); } catch (Throwable $e) {}
    try { $pdo->exec('CREATE INDEX IF NOT EXISTS idx_rides_sync ON rides(updated_at, deleted_at)'); } catch (Throwable $e) {}

    require_once __DIR__ . '/utils/geo_resolver.php';

    // 迁移：旧库可能仍有 r2 key 列、缺 detail_points 列、city 列、cities 列、is_cross_city 列、或增量同步字段
    try { $pdo->exec('ALTER TABLE rides ADD COLUMN detail_points TEXT'); } catch (Throwable $e) {}
    try { $pdo->exec('ALTER TABLE rides ADD COLUMN city TEXT'); } catch (Throwable $e) {}
    try { $pdo->exec('ALTER TABLE rides ADD COLUMN cities TEXT'); } catch (Throwable $e) {}
    try { $pdo->exec('ALTER TABLE rides ADD COLUMN is_cross_city INTEGER DEFAULT 0'); } catch (Throwable $e) {}
    try { $pdo->exec('ALTER TABLE rides ADD COLUMN updated_at INTEGER'); } catch (Throwable $e) {}
    try { $pdo->exec('ALTER TABLE rides ADD COLUMN deleted_at INTEGER'); } catch (Throwable $e) {}
    try { $pdo->exec('ALTER TABLE rides DROP COLUMN detail_points_r2_key'); } catch (Throwable $e) {}
    try { $pdo->exec('ALTER TABLE rides DROP COLUMN raw_tcx_r2_key'); } catch (Throwable $e) {}
    try { $pdo->exec("UPDATE rides SET updated_at = COALESCE(created_at, CAST(strftime('%s', 'now') AS INTEGER) * 1000) WHERE updated_at IS NULL"); } catch (Throwable $e) {}

    // 自动回填：为历史记录中缺失 cities 或 city 的行自动补齐城市与跨城信息
    try {
        $stmt = $pdo->query("SELECT id, start_lat, start_lng, summary_polyline, city, cities FROM rides WHERE cities IS NULL OR cities = '' OR city IS NULL OR city = ''");
        $unmigrated = $stmt->fetchAll();
        if (!empty($unmigrated)) {
            $upd = $pdo->prepare("UPDATE rides SET city = ?, cities = ?, is_cross_city = ? WHERE id = ?");
            foreach ($unmigrated as $r) {
                $info = resolve_ride_cities($r['start_lat'], $r['start_lng'], $r['summary_polyline']);
                $upd->execute([
                    $info['city'],
                    json_encode($info['cities'], JSON_UNESCAPED_UNICODE),
                    $info['is_cross_city'] ? 1 : 0,
                    $r['id']
                ]);
            }
        }
    } catch (Throwable $e) {
        error_log('[dbInit] auto-fill city/cities failed: ' . $e->getMessage());
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS privacy_zones (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            radius_meters REAL DEFAULT 500
        )
    ");

    // ai_config 只存 base_url + model_name（api_key 走 Gateway team key，不存后端）
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS ai_config (
            id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
            base_url TEXT NOT NULL DEFAULT '',
            model_name TEXT NOT NULL DEFAULT 'velotrack-coach',
            updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS ride_insights (
            ride_id TEXT PRIMARY KEY,
            content_hash TEXT NOT NULL,
            insight TEXT NOT NULL,
            created_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS ride_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ride_id TEXT NOT NULL,
            tag TEXT NOT NULL,
            UNIQUE(ride_id, tag)
        )
    ");

    $pdo->exec("
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
    ");

    $pdo->exec("
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
            custom_specs TEXT DEFAULT '{\"pedals\": \"平踏\", \"wheelset\": \"20寸406\"}',
            injuries_notes TEXT NOT NULL DEFAULT '右膝半月板轻微劳损史，需维持85-95rpm高踏频防护',
            primary_goal TEXT NOT NULL DEFAULT 'W1-2稳扎16km/h均速门槛，建立高踏频肌肉记忆，向20km/h进发',
            updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
    ");

    // rider_profile 增量列（旧库补列）
    try { $pdo->exec('ALTER TABLE rider_profile ADD COLUMN gear_ratio TEXT'); } catch (Throwable $e) {}
    try { $pdo->exec('ALTER TABLE rider_profile ADD COLUMN tires TEXT'); } catch (Throwable $e) {}
    try { $pdo->exec('ALTER TABLE rider_profile ADD COLUMN bike_weight_kg REAL'); } catch (Throwable $e) {}
    try { $pdo->exec('ALTER TABLE rider_profile ADD COLUMN custom_specs TEXT'); } catch (Throwable $e) {}

    // rider_memories 重建式迁移：移除限制性 CHECK，加 importance
    migrate_rider_memories($pdo);

    $pdo->exec("
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
    ");
    try { $pdo->exec('ALTER TABLE rider_memories ADD COLUMN importance INTEGER NOT NULL DEFAULT 3'); } catch (Throwable $e) {}

    $pdo->exec("
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
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS training_goals (
            id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
            weekly_distance_km REAL NOT NULL DEFAULT 60.0,
            target_avg_speed_kmh REAL NOT NULL DEFAULT 18.0,
            monthly_distance_km REAL NOT NULL DEFAULT 180.0,
            annual_distance_km REAL NOT NULL DEFAULT 1000.0,
            coach_notes TEXT DEFAULT '换档至46/17T（第3档），绿灯路段锁90rpm巡航23km/h，红灯停车挂轻档准备起步。',
            updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
    ");

    // --- seed ---
    $pdo->exec("
        INSERT OR IGNORE INTO ai_config (id, base_url, model_name)
        VALUES (1, '', 'velotrack-coach')
    ");

    $pdo->exec("
        INSERT OR IGNORE INTO rider_profile (id, name, gender, weight_kg, height_cm, max_hr, resting_hr, ftp_watts, current_bike, gear_ratio, tires, bike_weight_kg, bike_specs, custom_specs, injuries_notes, primary_goal)
        VALUES (1, 'VerNe Yuu', 'male', 75.0, 173.0, 188, 55, 165, '大行 P8', '46T牙盘 + 11-28T 7速飞轮', '马牌 Contact Urban 2.0 轮胎 (75-80 psi)', 11.5, '46T牙盘 + 11-28T 7速飞轮 | 马牌 Contact Urban 2.0 轮胎', '{\"pedals\": \"平踏\", \"wheelset\": \"20寸406\"}', '右膝半月板轻微劳损史，需维持85-95rpm高踏频防护', 'W1-2稳扎16km/h均速门槛，建立高踏频肌肉记忆，向20km/h进发')
    ");

    $pdo->exec("
        INSERT OR IGNORE INTO training_goals (id, weekly_distance_km, target_avg_speed_kmh, monthly_distance_km, annual_distance_km, coach_notes)
        VALUES (1, 60.0, 18.0, 180.0, 1000.0, '换档至46/17T（第3档），绿灯路段锁90rpm巡航23km/h，红灯停车挂轻档准备起步。')
    ");

    // 清理脏数据（长段落 dump）
    try {
        $dirty = $pdo->query("SELECT id FROM rider_memories WHERE length(content) > 100 OR content LIKE '%教练根据车手近期状态主动设定新目标%'")->fetchAll();
        foreach ($dirty as $d) {
            $stmt = $pdo->prepare('DELETE FROM rider_memories WHERE id = ?');
            $stmt->execute([(int)$d['id']]);
        }
    } catch (Throwable $e) {}

    // seed 标准原子事实（仅空表时）
    seed_rider_memories_if_empty($pdo);
    seed_goal_milestones_if_empty($pdo);

    try { $pdo->exec('CREATE INDEX IF NOT EXISTS idx_rides_start_time ON rides(start_time)'); } catch (Throwable $e) {}
}

/**
 * rider_memories 重建式迁移：旧表若有 CHECK(category IN) 约束则重建。
 */
function migrate_rider_memories(PDO $pdo): void
{
    try {
        $row = db_first($pdo, "SELECT sql FROM sqlite_master WHERE type='table' AND name='rider_memories'");
        if ($row && str_contains($row['sql'] ?? '', 'CHECK(category IN')) {
            $pdo->exec("
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
            ");
            $pdo->exec("
                INSERT INTO rider_memories_v2 (id, category, memory_key, content, source, is_active, created_at, updated_at)
                SELECT id, category, memory_key, content, source, is_active, created_at, updated_at FROM rider_memories
            ");
            $pdo->exec('DROP TABLE rider_memories');
            $pdo->exec('ALTER TABLE rider_memories_v2 RENAME TO rider_memories');
        }
    } catch (Throwable $e) {
        error_log('[dbInit] rider_memories migration note: ' . $e->getMessage());
    }
}

function seed_rider_memories_if_empty(PDO $pdo): void
{
    try {
        $row = db_first($pdo, 'SELECT COUNT(*) as count FROM rider_memories');
        if ($row && (int)$row['count'] === 0) {
            $now = time();
            $stmt = $pdo->prepare("
                INSERT INTO rider_memories (category, memory_key, content, source, importance, is_active, created_at, updated_at)
                VALUES
                  ('health', 'knee_safety_rule', '右膝半月板有劳损史，踏频低于80rpm容易酸痛，红灯起步须提前降档轻蹬，切忌大齿比重踏。', 'coach', 5, 1, ?, ?),
                  ('gear', 'p8_sweetspot_gear', '大行P8巡航甜点：46x18T/17T搭配90rpm踏频（时速约20~23km/h）最顺畅省力；马牌2.0胎压维持75-80psi。', 'coach', 4, 1, ?, ?),
                  ('habit', 'night_ride_preference', '骑行时段主要在夜间与傍晚，偏好照明良好、红绿灯较少的平路绿道。', 'manual', 3, 1, ?, ?),
                  ('preference', 'cadence_focus_style', '训练偏好：优先打磨稳定踏频基底与 Zone 2 有氧心率，循序渐进提速，排斥激进过量。', 'coach', 4, 1, ?, ?)
            ");
            $stmt->execute([$now - 86400 * 3, $now, $now - 86400 * 2, $now, $now - 86400, $now, $now, $now]);
        }
    } catch (Throwable $e) {
        error_log('[dbInit] seed rider_memories note: ' . $e->getMessage());
    }
}

function seed_goal_milestones_if_empty(PDO $pdo): void
{
    try {
        $row = db_first($pdo, 'SELECT COUNT(*) as count FROM goal_milestones');
        if ($row && (int)$row['count'] === 0) {
            $stmt = $pdo->prepare("
                INSERT INTO goal_milestones (weekly_distance_km, target_avg_speed_kmh, monthly_distance_km, primary_goal, rationale, source, created_at)
                VALUES
                  (50.0, 16.0, 150.0, '基础踏频与有氧基底建立', '初始建档目标：建立85-95rpm高踏频骑行习惯', 'coach', ?),
                  (60.0, 18.0, 180.0, '绿灯路段巡航提速与 Zone2 稳态输出', '根据近期实战停表均速达标，主动上调单周里程至60km与巡航均速18km/h', 'coach', ?)
            ");
            $stmt->execute([time() - 86400 * 7, time() - 86400 * 7]);
        }
    } catch (Throwable $e) {
        error_log('[dbInit] seed goal_milestones note: ' . $e->getMessage());
    }
}

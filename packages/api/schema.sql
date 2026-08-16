-- 单次骑行核心数据表
CREATE TABLE IF NOT EXISTS rides (
  id TEXT PRIMARY KEY,                       -- 唯一标识 (UUID 或华为 TCX 起始时间戳)
  title TEXT NOT NULL,                       -- 骑行标题 (例如 "早晨骑行", "环千岛湖")
  start_time INTEGER NOT NULL,               -- 开始时间戳 (Unix Epoch ms)
  end_time INTEGER NOT NULL,                 -- 结束时间戳
  elapsed_time_seconds INTEGER NOT NULL,     -- 总用时 (秒)
  moving_time_seconds INTEGER NOT NULL,      -- 运动用时 (秒，排除静止)
  
  -- 基础距离与极值
  distance_meters REAL NOT NULL,             -- 骑行总里程 (米)
  max_speed_kmh REAL,                        -- 最高时速 (km/h)
  avg_speed_kmh REAL,                        -- 平均时速 (km/h)
  total_ascent_meters REAL,                  -- 累计爬升 (米)
  total_descent_meters REAL,                 -- 累计下降 (米)
  max_altitude_meters REAL,                  -- 最高海拔 (米)
  
  -- 生理指标与踏频
  avg_heart_rate INTEGER,                    -- 平均心率 (bpm)
  max_heart_rate INTEGER,                    -- 最高心率 (bpm)
  avg_cadence INTEGER,                       -- 平均踏频 (rpm)
  max_cadence INTEGER,                       -- 最大踏频 (rpm)
  calories INTEGER,                          -- 消耗卡路里 (kcal)
  
  -- 心率 5 区时间分布 (秒)
  hr_z1_seconds INTEGER DEFAULT 0,           -- 恢复区 (<60% HRmax)
  hr_z2_seconds INTEGER DEFAULT 0,           -- 燃脂/有氧耐力区 (60-70%)
  hr_z3_seconds INTEGER DEFAULT 0,           -- 马拉松/节奏区 (70-80%)
  hr_z4_seconds INTEGER DEFAULT 0,           -- 乳酸阈值区 (80-90%)
  hr_z5_seconds INTEGER DEFAULT 0,           -- 无氧极限区 (>90%)
  
  -- 地理与轨迹
  start_lat REAL,                            -- 起点纬度 (纠偏后)
  start_lng REAL,                            -- 起点经度 (纠偏后)
  summary_polyline TEXT,                     -- 降采样的精简轨迹 (用于列表缩略图与总热力图)
  detail_points_r2_key TEXT,                 -- R2 中完整降采样点位 JSON 路径 (包含瞬时海拔/心率/速度)
  raw_tcx_r2_key TEXT,                       -- R2 中原始 TCX 文件存储路径
  
  is_commute INTEGER DEFAULT 0,              -- 是否为通勤
  created_at INTEGER NOT NULL
);

-- 隐私脱敏圆区 (在设置半径内的轨迹点自动隐藏)
CREATE TABLE IF NOT EXISTS privacy_zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                        -- 如 "家", "公司"
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius_meters REAL DEFAULT 500             -- 默认 500 米遮罩半径
);

-- AI 模型配置表（单行约束）
CREATE TABLE IF NOT EXISTS ai_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
  base_url TEXT NOT NULL DEFAULT 'http://localhost:37183/v1',
  model_name TEXT NOT NULL DEFAULT 'deepseek-v4-flash',
  api_key TEXT NOT NULL DEFAULT 'sk-fU0SuTBSzwvd6hVyVDE6cQkT3R7QFVAikpYaetvDOZs9gOJp',
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 单次骑行分析哈希缓存表
CREATE TABLE IF NOT EXISTS ride_insights (
  ride_id TEXT PRIMARY KEY REFERENCES rides(id),
  content_hash TEXT NOT NULL,
  insight TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- 骑行标签表
CREATE TABLE IF NOT EXISTS ride_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ride_id TEXT NOT NULL REFERENCES rides(id),
  tag TEXT NOT NULL,
  UNIQUE(ride_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_ride_tags_ride_id ON ride_tags(ride_id);

-- 对话历史表
CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'tool')),
  content TEXT,
  tool_calls TEXT,
  tool_call_id TEXT,
  name TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id, created_at);

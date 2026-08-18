import { ensureTables } from './dbInit';

export interface RiderProfileData {
  id?: number;
  name: string;
  gender: string;
  weight_kg: number;
  height_cm: number;
  max_hr: number;
  resting_hr: number;
  ftp_watts: number;
  current_bike: string;
  gear_ratio?: string;
  tires?: string;
  bike_weight_kg?: number;
  bike_specs: string;
  custom_specs?: string | Record<string, any>;
  injuries_notes: string;
  primary_goal: string;
  updated_at?: number;
}

export interface TrainingGoalsData {
  weekly_distance_km: number;
  target_avg_speed_kmh: number;
  monthly_distance_km: number;
  annual_distance_km: number;
  coach_notes: string;
  updated_at?: number;
}

export interface GoalMilestone {
  id?: number;
  weekly_distance_km: number;
  target_avg_speed_kmh: number;
  monthly_distance_km?: number;
  primary_goal?: string;
  rationale: string;
  source: string;
  created_at?: number;
}

export async function getRiderProfile(db: D1Database): Promise<RiderProfileData> {
  await ensureTables(db);
  const profile = await db.prepare('SELECT * FROM rider_profile WHERE id = 1').first<any>();
  if (!profile) {
    return {
      name: 'VerNe Yuu',
      gender: 'male',
      weight_kg: 75.0,
      height_cm: 173.0,
      max_hr: 188,
      resting_hr: 55,
      ftp_watts: 165,
      current_bike: '大行 P8',
      gear_ratio: '46T牙盘 + 11-28T 7速飞轮',
      tires: '马牌 Contact Urban 2.0 轮胎 (75-80 psi)',
      bike_weight_kg: 11.5,
      bike_specs: '46T牙盘 + 11-28T 7速飞轮 | 马牌 Contact Urban 2.0 轮胎',
      custom_specs: '{"pedals": "平踏", "wheelset": "20寸406"}',
      injuries_notes: '右膝半月板轻微劳损史，需维持85-95rpm高踏频防护',
      primary_goal: 'W1-2稳扎16km/h均速门槛，建立高踏频肌肉记忆，向20km/h进发',
    };
  }

  let gear_ratio = profile.gear_ratio;
  let tires = profile.tires;
  const rawSpecs = profile.bike_specs || '';

  if (!gear_ratio) {
    if (rawSpecs.includes('46') || rawSpecs.includes('28') || rawSpecs.includes('7速')) {
      gear_ratio = '46T牙盘 + 11-28T 7速飞轮';
    } else {
      gear_ratio = '46T牙盘 + 11-28T 7速飞轮';
    }
  }

  if (!tires) {
    tires = '马牌 Contact Urban 2.0 轮胎 (75-80 psi)';
  }

  return {
    ...profile,
    gear_ratio,
    tires,
    bike_weight_kg: Number(profile.bike_weight_kg) || 11.5,
    custom_specs: profile.custom_specs || '{"pedals": "平踏", "wheelset": "20寸406"}',
  };
}

export async function updateRiderProfile(db: D1Database, data: Partial<RiderProfileData>) {
  await ensureTables(db);
  const cur = await getRiderProfile(db);

  let mergedCustomSpecs: Record<string, any> = {};
  try {
    if (typeof cur.custom_specs === 'string') {
      mergedCustomSpecs = JSON.parse(cur.custom_specs || '{}');
    } else if (typeof cur.custom_specs === 'object') {
      mergedCustomSpecs = { ...cur.custom_specs };
    }
  } catch {}

  if (data.custom_specs) {
    if (typeof data.custom_specs === 'string') {
      try {
        mergedCustomSpecs = { ...mergedCustomSpecs, ...JSON.parse(data.custom_specs) };
      } catch {
        mergedCustomSpecs.notes = data.custom_specs;
      }
    } else if (typeof data.custom_specs === 'object') {
      mergedCustomSpecs = { ...mergedCustomSpecs, ...data.custom_specs };
    }
  }

  const gear_ratio = data.gear_ratio !== undefined ? data.gear_ratio : cur.gear_ratio;
  const tires = data.tires !== undefined ? data.tires : cur.tires;
  const bike_weight_kg = data.bike_weight_kg !== undefined ? Number(data.bike_weight_kg) : cur.bike_weight_kg;

  const specParts: string[] = [];
  if (gear_ratio) specParts.push(gear_ratio);
  if (tires) specParts.push(tires);
  if (bike_weight_kg) specParts.push(`车重${bike_weight_kg}kg`);

  Object.entries(mergedCustomSpecs).forEach(([k, v]) => {
    if (v && typeof v === 'string') specParts.push(`${k}: ${v}`);
  });

  const synthesizedBikeSpecs = data.bike_specs && data.bike_specs.includes('|')
    ? data.bike_specs
    : (specParts.length > 0 ? specParts.join(' | ') : (data.bike_specs || cur.bike_specs));

  const merged = {
    ...cur,
    ...data,
    gear_ratio,
    tires,
    bike_weight_kg,
    bike_specs: synthesizedBikeSpecs,
    custom_specs: JSON.stringify(mergedCustomSpecs),
  };

  await db.prepare(`
    UPDATE rider_profile SET
      name = ?,
      gender = ?,
      weight_kg = ?,
      height_cm = ?,
      max_hr = ?,
      resting_hr = ?,
      ftp_watts = ?,
      current_bike = ?,
      gear_ratio = ?,
      tires = ?,
      bike_weight_kg = ?,
      bike_specs = ?,
      custom_specs = ?,
      injuries_notes = ?,
      primary_goal = ?,
      updated_at = unixepoch()
    WHERE id = 1
  `).bind(
    merged.name,
    merged.gender,
    Number(merged.weight_kg) || 75.0,
    Number(merged.height_cm) || 173.0,
    Number(merged.max_hr) || 188,
    Number(merged.resting_hr) || 55,
    Number(merged.ftp_watts) || 165,
    merged.current_bike,
    merged.gear_ratio,
    merged.tires,
    merged.bike_weight_kg,
    merged.bike_specs,
    merged.custom_specs,
    merged.injuries_notes,
    merged.primary_goal
  ).run();

  return merged;
}

export async function getTrainingGoals(db: D1Database): Promise<TrainingGoalsData> {
  await ensureTables(db);
  const row = await db.prepare('SELECT * FROM training_goals WHERE id = 1').first<any>();
  return {
    weekly_distance_km: Number(row?.weekly_distance_km) || 60.0,
    target_avg_speed_kmh: Number(row?.target_avg_speed_kmh) || 18.0,
    monthly_distance_km: Number(row?.monthly_distance_km) || 180.0,
    annual_distance_km: Number(row?.annual_distance_km) || 1000.0,
    coach_notes: row?.coach_notes || '换档至46/17T（第3档），绿灯路段锁90rpm巡航23km/h，红灯停车挂轻档准备起步。',
    updated_at: row?.updated_at
  };
}

export async function updateTrainingGoals(db: D1Database, data: Partial<TrainingGoalsData>) {
  await ensureTables(db);
  const cur = await getTrainingGoals(db);
  // 显式合并：未提供的字段回落为当前值，避免 undefined 传入 D1 bind 报 D1_TYPE_ERROR
  const merged = {
    weekly_distance_km: data.weekly_distance_km !== undefined ? Number(data.weekly_distance_km) : cur.weekly_distance_km,
    target_avg_speed_kmh: data.target_avg_speed_kmh !== undefined ? Number(data.target_avg_speed_kmh) : cur.target_avg_speed_kmh,
    monthly_distance_km: data.monthly_distance_km !== undefined ? Number(data.monthly_distance_km) : cur.monthly_distance_km,
    annual_distance_km: data.annual_distance_km !== undefined ? Number(data.annual_distance_km) : cur.annual_distance_km,
    coach_notes: data.coach_notes !== undefined ? data.coach_notes : cur.coach_notes,
  };

  await db.prepare(`
    UPDATE training_goals SET
      weekly_distance_km = ?,
      target_avg_speed_kmh = ?,
      monthly_distance_km = ?,
      annual_distance_km = ?,
      coach_notes = ?,
      updated_at = unixepoch()
    WHERE id = 1
  `).bind(
    merged.weekly_distance_km,
    merged.target_avg_speed_kmh,
    merged.monthly_distance_km,
    merged.annual_distance_km,
    merged.coach_notes
  ).run();

  return merged;
}

// L3: Goal Milestones Evolution
export async function getGoalMilestones(db: D1Database, limit = 5): Promise<GoalMilestone[]> {
  await ensureTables(db);
  const rows = await db.prepare(`
    SELECT * FROM goal_milestones 
    ORDER BY created_at DESC 
    LIMIT ?
  `).bind(limit).all<any>();
  return rows.results || [];
}

export async function addGoalMilestone(db: D1Database, data: {
  weekly_distance_km: number;
  target_avg_speed_kmh: number;
  monthly_distance_km?: number;
  primary_goal?: string;
  rationale: string;
  source?: string;
}) {
  await ensureTables(db);
  const res = await db.prepare(`
    INSERT INTO goal_milestones (weekly_distance_km, target_avg_speed_kmh, monthly_distance_km, primary_goal, rationale, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
  `).bind(
    data.weekly_distance_km,
    data.target_avg_speed_kmh,
    data.monthly_distance_km || data.weekly_distance_km * 3,
    data.primary_goal || '',
    data.rationale.slice(0, 100),
    data.source || 'coach'
  ).run();

  return res.meta.last_row_id;
}

// L2: Semantic Profile Memories (Atomic Facts Store)
export async function getRiderMemories(db: D1Database, activeOnly = false) {
  await ensureTables(db);
  const query = activeOnly
    ? 'SELECT * FROM rider_memories WHERE is_active = 1 ORDER BY importance DESC, created_at DESC'
    : 'SELECT * FROM rider_memories ORDER BY is_active DESC, importance DESC, created_at DESC';
  const rows = await db.prepare(query).all<any>();
  return rows.results || [];
}

/**
 * Idempotent Atomic Memory Upsert (De-duplication & Merging Engine)
 */
export async function upsertRiderMemory(
  db: D1Database,
  category: string,
  key: string,
  content: string,
  source = 'manual',
  importance = 3
) {
  await ensureTables(db);

  // Normalize categories: health, gear, habit, preference
  let normalizedCat = category;
  if (category === 'physiology') normalizedCat = 'health';
  if (category === 'coaching' || category === 'goal') normalizedCat = 'preference';

  // Check if existing memory with same key or exact same content exists
  const existing = await db.prepare(`
    SELECT id, content FROM rider_memories 
    WHERE memory_key = ? OR content = ?
    LIMIT 1
  `).bind(key, content).first<any>();

  if (existing) {
    await db.prepare(`
      UPDATE rider_memories SET
        category = ?,
        content = ?,
        source = ?,
        importance = ?,
        is_active = 1,
        updated_at = unixepoch()
      WHERE id = ?
    `).bind(normalizedCat, content.trim(), source, importance, existing.id).run();
    return existing.id;
  }

  const res = await db.prepare(`
    INSERT INTO rider_memories (category, memory_key, content, source, importance, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, unixepoch(), unixepoch())
  `).bind(normalizedCat, key.trim(), content.trim(), source, importance).run();

  return res.meta.last_row_id;
}

export async function addRiderMemory(
  db: D1Database,
  category: string,
  key: string,
  content: string,
  source = 'manual'
) {
  return upsertRiderMemory(db, category, key, content, source, 3);
}

export async function deleteRiderMemory(db: D1Database, id: string | number) {
  await ensureTables(db);
  await db.prepare('DELETE FROM rider_memories WHERE id = ?').bind(id).run();
}

/**
 * Tiered Agentic Memory Prompt Assembly Engine
 */
export async function getRiderContextPrompt(db: D1Database): Promise<string> {
  const profile = await getRiderProfile(db);
  const memories = await getRiderMemories(db, true);
  const goals = await getTrainingGoals(db);
  const milestones = await getGoalMilestones(db, 2);

  // Compute real recent stats from rides table
  const allRides = await db.prepare('SELECT * FROM rides ORDER BY start_time DESC').all<any>();
  const rides = allRides.results || [];

  const totalDistMeters = rides.reduce((acc, r) => acc + (r.distance_meters || 0), 0);
  const totalDistKm = Number((totalDistMeters / 1000).toFixed(1));
  const totalAscentM = rides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0);
  
  // Dual time aggregations
  const totalMovingSec = rides.reduce((acc, r) => acc + (r.moving_time_seconds || r.elapsed_time_seconds || 0), 0);
  const totalElapsedSec = rides.reduce((acc, r) => acc + (r.elapsed_time_seconds || r.moving_time_seconds || 0), 0);
  const totalPausedSec = Math.max(0, totalElapsedSec - totalMovingSec);
  const totalMovingRatioPct = totalElapsedSec > 0 ? Math.round((totalMovingSec / totalElapsedSec) * 100) : 100;

  const totalMovingHours = Number((totalMovingSec / 3600).toFixed(1));
  const totalElapsedHours = Number((totalElapsedSec / 3600).toFixed(1));
  const totalPausedHours = Number((totalPausedSec / 3600).toFixed(1));

  // Dual speed aggregations
  const overallMovingAvgSpeed = totalMovingSec > 0 ? Number(((totalDistMeters / 1000) / (totalMovingSec / 3600)).toFixed(1)) : 0;
  const overallElapsedAvgSpeed = totalElapsedSec > 0 ? Number(((totalDistMeters / 1000) / (totalElapsedSec / 3600)).toFixed(1)) : 0;

  // Best moving speeds
  const bestMovingAvgSpeed = rides.reduce((acc, r) => {
    const mSec = r.moving_time_seconds || r.elapsed_time_seconds || 0;
    const spd = mSec > 0 ? ((r.distance_meters || 0) / 1000) / (mSec / 3600) : 0;
    return Math.max(acc, Number(spd.toFixed(1)));
  }, 0);

  const maxSprint = rides.reduce((acc, r) => Math.max(acc, r.max_speed_kmh || 0), 0);
  const longestRide = rides.reduce((acc, r) => Math.max(acc, (r.distance_meters || 0) / 1000), 0);

  // Recent week activity
  const latestRideTime = Math.max(...rides.map((r) => r.start_time || 0));
  const refDate = new Date(latestRideTime > 0 ? latestRideTime : Date.now());
  const day = refDate.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  const weekRides = rides.filter(
    (r) => r.start_time >= monday.getTime() && r.start_time < sunday.getTime()
  );
  const thisWeekDistMeters = weekRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0);
  const thisWeekKm = Number((thisWeekDistMeters / 1000).toFixed(1));
  const thisWeekMovingSec = weekRides.reduce((acc, r) => acc + (r.moving_time_seconds || r.elapsed_time_seconds || 0), 0);
  const thisWeekElapsedSec = weekRides.reduce((acc, r) => acc + (r.elapsed_time_seconds || r.moving_time_seconds || 0), 0);
  const thisWeekPausedSec = Math.max(0, thisWeekElapsedSec - thisWeekMovingSec);

  const thisWeekMovingSpeed = thisWeekMovingSec > 0 
    ? Number(((thisWeekDistMeters / 1000) / (thisWeekMovingSec / 3600)).toFixed(1))
    : 0;
  const thisWeekElapsedSpeed = thisWeekElapsedSec > 0
    ? Number(((thisWeekDistMeters / 1000) / (thisWeekElapsedSec / 3600)).toFixed(1))
    : 0;

  const weeklyCompletionPct = Math.round((thisWeekKm / goals.weekly_distance_km) * 100);
  const speedCompletionPct = Math.round((bestMovingAvgSpeed / goals.target_avg_speed_kmh) * 100);

  // Group semantic memories by tier
  const healthMemories = memories.filter(m => m.category === 'health' || m.category === 'physiology');
  const gearMemories = memories.filter(m => m.category === 'gear');
  const habitMemories = memories.filter(m => m.category === 'habit' || m.category === 'preference' || m.category === 'coaching');

  let semanticFactsSection = '';
  if (healthMemories.length > 0) {
    semanticFactsSection += `  - 🩺【健康与伤病底线】:\n` + healthMemories.map(m => `    * ${m.content}`).join('\n') + '\n';
  }
  if (gearMemories.length > 0) {
    semanticFactsSection += `  - 🚲【战车调校经验】:\n` + gearMemories.map(m => `    * ${m.content}`).join('\n') + '\n';
  }
  if (habitMemories.length > 0) {
    semanticFactsSection += `  - ⏱️【习惯与偏好画像】:\n` + habitMemories.map(m => `    * ${m.content}`).join('\n') + '\n';
  }

  let milestoneSection = '';
  if (milestones.length > 0) {
    milestoneSection = `【L3 阶段目标演进轨迹 (近期里程碑记录)】:\n` + 
      milestones.map(m => `  - [${new Date((m.created_at || Date.now() / 1000) * 1000).toLocaleDateString('zh-CN')}] 单周 ${m.weekly_distance_km}km / 巡航停表均速 ${m.target_avg_speed_kmh}km/h (理由: ${m.rationale})`).join('\n') + '\n\n';
  }

  return `【L1 车手专属生理与战车基底档案】：
- 车手: ${profile.name}（性别: ${profile.gender === 'female' ? '女' : '男'}，体重: ${profile.weight_kg}kg，身高: ${profile.height_cm}cm）
- 生理基准: 最大心率 ${profile.max_hr} bpm, 静息心率 ${profile.resting_hr} bpm, FTP: ${profile.ftp_watts} W
- 主力战车: ${profile.current_bike} (净重 ${profile.bike_weight_kg || 11.5} kg)
- 齿比与外胎: ${profile.gear_ratio || '46T牙盘 + 11-28T 7速飞轮'} · ${profile.tires || '马牌 Contact Urban 2.0 轮胎 (75-80 psi)'}
- 器材综合配置: ${profile.bike_specs}
- 伤病概况: ${profile.injuries_notes || '暂无急性伤病'}

【L1 系统当前生效量化目标】：
- 单周目标里程: ${goals.weekly_distance_km} km (本周已完成: ${thisWeekKm} km, 完成度: ${weeklyCompletionPct}%)
- 目标【停表巡航均速】: ${goals.target_avg_speed_kmh} km/h (历史最佳单次停表均速: ${bestMovingAvgSpeed} km/h, 达标率: ${speedCompletionPct}%)
- 单月目标: ${goals.monthly_distance_km} km · 年度目标: ${goals.annual_distance_km} km (累计完成: ${totalDistKm} km)
- 当前教练策略: "${goals.coach_notes}"

【L2 车手长期语义记忆与偏好画像 (已沉淀原子事实)】:
${semanticFactsSection || '  - 暂无特殊偏好记录，以标准高踏频防伤膝原则执教。\n'}
${milestoneSection}【L4 车手真实数据库近期实战状态（双均速与踩踏做功）】：
- 历史总记录: ${rides.length} 次骑行，累计里程: ${totalDistKm} km，累计爬升: ${totalAscentM} m
- ⏱️ 累计纯运动踩踏: ${totalMovingHours} 小时，⏳ 累计门到门历时: ${totalElapsedHours} 小时，⏸️ 累计停顿: ${totalPausedHours} 小时 (做功占比: ${totalMovingRatioPct}%)
- ⚡ 历史整体【停表运动均速】: ${overallMovingAvgSpeed} km/h · 🌐 历史整体【总历时均速】: ${overallElapsedAvgSpeed} km/h
- 🏆 历史最佳【停表均速】: ${bestMovingAvgSpeed} km/h · 冲刺最高极速: ${maxSprint.toFixed(1)} km/h · 最长单次: ${longestRide.toFixed(1)} km
- 📅 本周实战数据: ${weekRides.length} 次骑行，累计 ${thisWeekKm} km。纯运动时间 ${(thisWeekMovingSec / 60).toFixed(1)} 分，停顿 ${(thisWeekPausedSec / 60).toFixed(1)} 分。本周【停表均速】: ${thisWeekMovingSpeed} km/h，【总均速】: ${thisWeekElapsedSpeed} km/h
- 近期身体适应度: 【良好·具备进阶潜力】（右膝无急性剧痛报告，高踏频打磨中）`;
}

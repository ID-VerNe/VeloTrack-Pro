/**
 * VeloTrack 确定性自行车运动学与动力学物理计算引擎
 * 消除 LLM 概率预测在齿比、踏频、时速换算、重力做功与心率区间中的口算幻觉。
 */

export const STANDARD_WHEEL_CIRCUMFERENCES: Record<string, number> = {
  '20x2.0': 1.54,        // 大行 P8 / 20寸 406 x 2.0 (如马牌 Contact Urban 2.0)
  '20x1.75': 1.515,     // 20寸 406 x 1.75
  '20x1.5': 1.49,       // 20寸 406 x 1.5
  '20x1.35': 1.46,      // 20寸 406 x 1.35
  '20x1-1/8': 1.545,    // 20寸 451
  '700x23c': 2.097,     // 标准公路车 23c
  '700x25c': 2.105,     // 标准公路车 25c
  '700x28c': 2.136,     // 耐力公路车 28c
  '700x32c': 2.155,     // 全地形/Gravel 32c
  '26x1.95': 2.055,     // 26寸山地车
  '29x2.2': 2.298,      // 29寸山地车
};

export interface GearCadenceSpeedOptions {
  chainring: number;                 // 前牙盘齿数 (如 46)
  cogs?: number[];                   // 后飞轮齿数列表 (如 [11, 13, 15, 17, 19, 21, 24, 28])
  wheelSpec?: string;                // 轮径规格 (如 "20x2.0" 或 "700x25c")
  customCircumferenceM?: number;     // 自定义有效轮径周长 (米)
  cadenceRpm?: number;               // 给定踏频 (rpm)，计算各档时速
  targetSpeedKmh?: number;           // 给定目标时速 (km/h)，倒推各档所需踏频
}

export interface GearAnalysisResult {
  chainring: number;
  wheel_circumference_m: number;
  wheel_spec: string;
  gear_table: Array<{
    cog: number;
    gear_ratio: number;              // 传动比 (前/后)
    development_meters: number;       // 齿比米数 (每踩一圈前进米数)
    gear_inches: number;              // 齿比寸数
    speed_at_cadence_kmh?: number;    // 在给定踏频下的时速
    cadence_for_target_speed?: number;// 在给定目标时速下需要的踏频
    is_sweetspot_recommended?: boolean;// 是否落在 85-95rpm 黄金踏频区间
    sweetspot_speed_range_kmh: { min: number; max: number }; // 该档在 85~95rpm 下的速度区间
  }>;
  recommended_cruising_cog?: {
    cog: number;
    gear_ratio: number;
    required_cadence_rpm: number;
    rationale: string;
  };
}

/**
 * 1. 齿比-踏频-时速高精度运动学双向换算
 */
export function calculateGearCadenceSpeed(options: GearCadenceSpeedOptions): GearAnalysisResult {
  const chainring = Number(options.chainring) || 46;
  const cogs = options.cogs && options.cogs.length > 0
    ? options.cogs.sort((a, b) => a - b)
    : [11, 13, 15, 17, 19, 21, 24, 28]; // 默认大行 P8 7/8 速常见齿比

  const wheelSpec = options.wheelSpec || '20x2.0';
  const circumference = options.customCircumferenceM || STANDARD_WHEEL_CIRCUMFERENCES[wheelSpec] || 1.54;
  const wheelDiameterInches = (circumference / Math.PI) * 39.3701;

  const cadence = options.cadenceRpm ? Number(options.cadenceRpm) : undefined;
  const targetSpeed = options.targetSpeedKmh ? Number(options.targetSpeedKmh) : undefined;

  let bestCogForTarget: any = null;
  let minCadenceDiffTo90 = Infinity;

  const gearTable = cogs.map((cog) => {
    const ratio = Number((chainring / cog).toFixed(2));
    const development = Number((ratio * circumference).toFixed(2));
    const gearInches = Number((ratio * wheelDiameterInches).toFixed(1));

    // 速度 (km/h) = 踏频 * 传动比 * 周长 * 60 / 1000 = 踏频 * ratio * circumference * 0.06
    const speedAtCadence = cadence !== undefined
      ? Number((cadence * ratio * circumference * 0.06).toFixed(1))
      : undefined;

    // 踏频 (rpm) = 速度 / (ratio * circumference * 0.06)
    const cadenceForSpeed = targetSpeed !== undefined
      ? Math.round(targetSpeed / (ratio * circumference * 0.06))
      : undefined;

    const minSweetSpeed = Number((85 * ratio * circumference * 0.06).toFixed(1));
    const maxSweetSpeed = Number((95 * ratio * circumference * 0.06).toFixed(1));

    const isSweetspot = cadenceForSpeed !== undefined && cadenceForSpeed >= 82 && cadenceForSpeed <= 96;

    if (cadenceForSpeed !== undefined) {
      const diffTo90 = Math.abs(cadenceForSpeed - 90);
      if (diffTo90 < minCadenceDiffTo90) {
        minCadenceDiffTo90 = diffTo90;
        bestCogForTarget = {
          cog,
          gear_ratio: ratio,
          required_cadence_rpm: cadenceForSpeed,
          rationale: `在 ${targetSpeed} km/h 巡航时，${chainring}/${cog}T 档位需要 ${cadenceForSpeed} rpm 踏频，完美落在 85-95 rpm 黄金高效有氧保护区间。`,
        };
      }
    }

    return {
      cog,
      gear_ratio: ratio,
      development_meters: development,
      gear_inches: gearInches,
      speed_at_cadence_kmh: speedAtCadence,
      cadence_for_target_speed: cadenceForSpeed,
      is_sweetspot_recommended: isSweetspot,
      sweetspot_speed_range_kmh: { min: minSweetSpeed, max: maxSweetSpeed },
    };
  });

  return {
    chainring,
    wheel_circumference_m: circumference,
    wheel_spec: wheelSpec,
    gear_table: gearTable,
    recommended_cruising_cog: bestCogForTarget || undefined,
  };
}

export interface ClimbingPowerOptions {
  riderWeightKg: number;
  bikeWeightKg?: number;
  ascentMeters: number;
  movingTimeSeconds: number;
  ftpWatts?: number;
}

export interface ClimbingPowerResult {
  total_system_mass_kg: number;
  ascent_meters: number;
  moving_time_minutes: number;
  gravity_work_joules: number;
  gravity_work_kj: number;
  gravity_power_watts: number;
  gravity_w_per_kg: number;
  ftp_percentage?: number;
  intensity_rating: string;
  knee_strain_advisory: string;
}

/**
 * 2. 克服重力势能做功与爬升均摊功率精准计算
 */
export function calculateClimbingPower(options: ClimbingPowerOptions): ClimbingPowerResult {
  const riderWeight = Number(options.riderWeightKg) || 75;
  const bikeWeight = Number(options.bikeWeightKg) || 11.5;
  const totalMass = Number((riderWeight + bikeWeight).toFixed(1));

  const ascent = Number(options.ascentMeters) || 0;
  const movingSec = Math.max(1, Number(options.movingTimeSeconds) || 1);
  const movingMins = Number((movingSec / 60).toFixed(1));

  // W = m * g * h (Joules)
  const gravityWorkJoules = Math.round(totalMass * 9.80665 * ascent);
  const gravityWorkKj = Number((gravityWorkJoules / 1000).toFixed(1));

  // P = W / t (Watts)
  const gravityPowerWatts = Number((gravityWorkJoules / movingSec).toFixed(1));
  const wPerKg = Number((gravityPowerWatts / riderWeight).toFixed(2));

  const ftp = options.ftpWatts ? Number(options.ftpWatts) : undefined;
  const ftpPct = ftp && ftp > 0 ? Math.round((gravityPowerWatts / ftp) * 100) : undefined;

  let intensity = '微弱起伏负荷 (Zone 1-2)';
  if (gravityPowerWatts >= 80) intensity = '高强度爬坡 (Zone 4-5 阈值/无氧)';
  else if (gravityPowerWatts >= 45) intensity = '中度爬坡阻力 (Zone 3 节奏区间)';
  else if (gravityPowerWatts >= 20) intensity = '轻度起伏做功 (Zone 2 有氧耐力)';

  let kneeAdvice = '爬升坡度平缓，维持 85+ rpm 顺畅踩踏即可。';
  if (gravityPowerWatts >= 50 || ascent > 200) {
    kneeAdvice = '爬升做功显著！遇到坡道务必提前 1-2 档降至小齿比，保持踏频不跌破 80 rpm，切忌站立摇车重踩以保护右膝半月板。';
  } else if (ascent > 80) {
    kneeAdvice = '起伏路段注意坡底提前减档，避免大齿比死蹬增加关节剪切应力。';
  }

  return {
    total_system_mass_kg: totalMass,
    ascent_meters: ascent,
    moving_time_minutes: movingMins,
    gravity_work_joules: gravityWorkJoules,
    gravity_work_kj: gravityWorkKj,
    gravity_power_watts: gravityPowerWatts,
    gravity_w_per_kg: wPerKg,
    ftp_percentage: ftpPct,
    intensity_rating: intensity,
    knee_strain_advisory: kneeAdvice,
  };
}

export interface HeartRateZonesOptions {
  maxHr: number;
  restingHr: number;
  currentAvgHr?: number;
}

export interface HeartRateZonesResult {
  max_hr: number;
  resting_hr: number;
  heart_rate_reserve: number;
  zones: {
    zone1_recovery: { min: number; max: number; label: string; description: string };
    zone2_endurance: { min: number; max: number; label: string; description: string };
    zone3_tempo: { min: number; max: number; label: string; description: string };
    zone4_threshold: { min: number; max: number; label: string; description: string };
    zone5_anaerobic: { min: number; max: number; label: string; description: string };
  };
  current_hr_assessment?: {
    hr: number;
    current_zone: string;
    description: string;
  };
}

/**
 * 3. 基于 Karvonen 储备心率的高精度生理区间计算
 */
export function calculateHeartRateZones(options: HeartRateZonesOptions): HeartRateZonesResult {
  const maxHr = Number(options.maxHr) || 188;
  const restingHr = Number(options.restingHr) || 55;
  const hrr = maxHr - restingHr;

  const z1Min = Math.round(restingHr + hrr * 0.50);
  const z1Max = Math.round(restingHr + hrr * 0.60);
  const z2Min = z1Max + 1;
  const z2Max = Math.round(restingHr + hrr * 0.70);
  const z3Min = z2Max + 1;
  const z3Max = Math.round(restingHr + hrr * 0.80);
  const z4Min = z3Max + 1;
  const z4Max = Math.round(restingHr + hrr * 0.90);
  const z5Min = z4Max + 1;
  const z5Max = maxHr;

  const zones = {
    zone1_recovery: { min: z1Min, max: z1Max, label: 'Zone 1 积极恢复', description: '放松排酸、极低代谢负荷、无心肺压力' },
    zone2_endurance: { min: z2Min, max: z2Max, label: 'Zone 2 黄金有氧耐力', description: '线粒体增殖、脂肪氧化效率最高、长距离基底核心区间' },
    zone3_tempo: { min: z3Min, max: z3Max, label: 'Zone 3 节奏巡航', description: '有氧糖原混合代谢、中等疲劳积累、高效巡航' },
    zone4_threshold: { min: z4Min, max: z4Max, label: 'Zone 4 乳酸阈值', description: '乳酸生成与清除平衡临界点、提升抗乳酸耐受力' },
    zone5_anaerobic: { min: z5Min, max: z5Max, label: 'Zone 5 无氧冲刺', description: '神经肌肉高强度爆发、心肺极限、严控持续时间' },
  };

  let currentAssessment: any = undefined;
  if (options.currentAvgHr) {
    const hr = Math.round(Number(options.currentAvgHr));
    let zName = '低于 Zone 1 (静息/微活动)';
    let desc = '身体处于极低负荷状态';
    if (hr >= z5Min) { zName = 'Zone 5 无氧极限'; desc = zones.zone5_anaerobic.description; }
    else if (hr >= z4Min) { zName = 'Zone 4 乳酸阈值'; desc = zones.zone4_threshold.description; }
    else if (hr >= z3Min) { zName = 'Zone 3 节奏巡航'; desc = zones.zone3_tempo.description; }
    else if (hr >= z2Min) { zName = 'Zone 2 黄金有氧耐力'; desc = zones.zone2_endurance.description; }
    else if (hr >= z1Min) { zName = 'Zone 1 积极恢复'; desc = zones.zone1_recovery.description; }

    currentAssessment = { hr, current_zone: zName, description: desc };
  }

  return {
    max_hr: maxHr,
    resting_hr: restingHr,
    heart_rate_reserve: hrr,
    zones,
    current_hr_assessment: currentAssessment,
  };
}

export interface GoalTimelineOptions {
  currentTotalKm: number;
  targetTotalKm: number;
  weeklyTargetKm: number;
  sessionsPerWeek?: number;
  targetAvgSpeedKmh?: number;
}

export interface GoalTimelineResult {
  current_total_km: number;
  target_total_km: number;
  remaining_km: number;
  completion_pct: number;
  weekly_target_km: number;
  estimated_weeks_remaining: number;
  sessions_per_week: number;
  km_per_session: number;
  estimated_hours_per_session?: number;
  estimated_minutes_per_session?: number;
}

/**
 * 4. 周期目标缺口与时间预算推演
 */
export function calculateGoalTimeline(options: GoalTimelineOptions): GoalTimelineResult {
  const current = Number(options.currentTotalKm) || 0;
  const target = Number(options.targetTotalKm) || 1000;
  const weekly = Math.max(1, Number(options.weeklyTargetKm) || 60);
  const sessions = Number(options.sessionsPerWeek) || 3;
  const speed = Number(options.targetAvgSpeedKmh) || 18;

  const remaining = Math.max(0, Number((target - current).toFixed(1)));
  const completionPct = Number(((current / target) * 100).toFixed(1));
  const weeksRemaining = Number((remaining / weekly).toFixed(1));
  const kmPerSession = Number((weekly / sessions).toFixed(1));

  const hoursPerSession = speed > 0 ? Number((kmPerSession / speed).toFixed(2)) : undefined;
  const minsPerSession = hoursPerSession ? Math.round(hoursPerSession * 60) : undefined;

  return {
    current_total_km: current,
    target_total_km: target,
    remaining_km: remaining,
    completion_pct: completionPct,
    weekly_target_km: weekly,
    estimated_weeks_remaining: weeksRemaining,
    sessions_per_week: sessions,
    km_per_session: kmPerSession,
    estimated_hours_per_session: hoursPerSession,
    estimated_minutes_per_session: minsPerSession,
  };
}

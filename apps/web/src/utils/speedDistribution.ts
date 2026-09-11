/**
 * 骑行真实运动学速度分层与稳态巡航特征提取引擎
 *
 * 核心算法规范：
 * 1. 稳态巡航时速：算法 4（P65-P97 截尾均值），自适应覆盖前 32% 运动时间，中位约 24.5-27 km/h；
 * 2. 巡航甜点区间：P75 到 P90 分位速度区间；
 * 3. 速度损耗落差：稳态巡航时速 - 停表移动均速（量化起步加速与路口吃掉的时速）；
 * 4. 时序持续稳态段（算法 3）：提取连续维持 >= 20 秒、波动标准差 <= 2.5 km/h 的稳速段落；
 * 5. 速度分层结构：停顿 (<2)、低速起步 (2-15)、节奏 (15-22)、稳态巡航 (22-30)、冲刺极速 (>=30)；
 * 6. 物理动力学反推：无独立踏频传感器时，以大行 P8 (46/15T) 齿比确定性反推踩踏踏频 (rpm)。
 */

export interface SpeedTierBreakdown {
  paused_secs: number;
  paused_pct: number;
  low_speed_secs: number;
  low_speed_pct: number;
  tempo_secs: number;
  tempo_pct: number;
  cruising_secs: number;
  cruising_pct: number;
  sprint_secs: number;
  sprint_pct: number;
}

export interface CruisingAnalysisResult {
  has_detail: boolean;
  cruising_avg_speed_kmh: number;
  cruising_range_kmh: [number, number]; // [P75, P90]
  speed_loss_kmh: number;
  speed_loss_pct: number;
  sustained_segments_count: number;
  sustained_avg_speed_kmh: number;
  derived_cadence_rpm: number;
  cadence_zone_status: 'golden' | 'low' | 'high';
  speed_tiers: SpeedTierBreakdown;
  summary_text: string;
}

export function calcPercentile(sortedVals: number[], p: number): number {
  if (!sortedVals || sortedVals.length === 0) return 0.0;
  const k = (sortedVals.length - 1) * (p / 100.0);
  const f = Math.floor(k);
  const c = Math.min(f + 1, sortedVals.length - 1);
  const d = k - f;
  return Number((sortedVals[f] + (sortedVals[c] - sortedVals[f]) * d).toFixed(1));
}

/**
 * 根据大行 P8 (46T 牙盘, 15T 飞轮, 20x2.0 外胎周长 1.54m) 反推理论踩踏踏频
 */
export function deriveCadenceFromSpeed(
  speedKmh: number,
  chainring = 46,
  cog = 15,
  wheelCircumferenceMeters = 1.54
): number {
  if (speedKmh <= 0) return 0;
  const ratio = chainring / cog;
  // Speed(km/h) = Cadence * ratio * circ * 60 / 1000
  // Cadence = Speed * 1000 / (ratio * circ * 60)
  const cadence = (speedKmh * 1000.0) / (ratio * wheelCircumferenceMeters * 60.0);
  return Number(cadence.toFixed(1));
}

export interface MinimalPoint {
  t?: number;
  sp?: number;
}

/**
 * 提取全量速度分层与稳态巡航特征
 */
export function analyzeSpeedDistribution(
  points: MinimalPoint[] | null | undefined,
  fallbackMovingAvgKmh = 18.0,
  chainring = 46,
  cog = 15
): CruisingAnalysisResult {
  if (!points || points.length < 10) {
    // 降级模式：无逐点明细时的实测拟合经验模型（巡航时速 = 停表均速 + 6.2 km/h）
    const estimatedCruise = Number((fallbackMovingAvgKmh + 6.2).toFixed(1));
    const speedLoss = 6.2;
    const derivedCadence = deriveCadenceFromSpeed(estimatedCruise, chainring, cog);

    return {
      has_detail: false,
      cruising_avg_speed_kmh: estimatedCruise,
      cruising_range_kmh: [Number((estimatedCruise - 1.2).toFixed(1)), Number((estimatedCruise + 1.2).toFixed(1))],
      speed_loss_kmh: speedLoss,
      speed_loss_pct: Math.round((speedLoss / estimatedCruise) * 100),
      sustained_segments_count: 0,
      sustained_avg_speed_kmh: Number((estimatedCruise - 2.0).toFixed(1)),
      derived_cadence_rpm: derivedCadence,
      cadence_zone_status: derivedCadence >= 85 && derivedCadence <= 95 ? 'golden' : derivedCadence < 85 ? 'low' : 'high',
      speed_tiers: {
        paused_secs: 0,
        paused_pct: 10,
        low_speed_secs: 0,
        low_speed_pct: 25,
        tempo_secs: 0,
        tempo_pct: 35,
        cruising_secs: 0,
        cruising_pct: 28,
        sprint_secs: 0,
        sprint_pct: 2,
      },
      summary_text: `稳态平路巡航约 ${estimatedCruise} km/h（估算值），低速与红绿灯损耗约 ${speedLoss} km/h。`,
    };
  }

  const validPoints = points.filter((p) => p.sp !== undefined && p.sp !== null && !isNaN(p.sp));
  const totalCount = validPoints.length;
  if (totalCount < 10) {
    return analyzeSpeedDistribution(null, fallbackMovingAvgKmh, chainring, cog);
  }

  const movingPoints = validPoints.filter((p) => p.sp! >= 2.0);
  const movingSpeeds = movingPoints.map((p) => p.sp!).sort((a, b) => a - b);

  // 1. 算法 4：P65-P97 截尾均值提取稳态巡航速度
  let cruisingAvg = fallbackMovingAvgKmh;
  let p75 = fallbackMovingAvgKmh;
  let p90 = fallbackMovingAvgKmh;

  if (movingSpeeds.length >= 10) {
    const p65Val = calcPercentile(movingSpeeds, 65);
    const p97Val = calcPercentile(movingSpeeds, 97);
    p75 = calcPercentile(movingSpeeds, 75);
    p90 = calcPercentile(movingSpeeds, 90);

    const trimmed = movingSpeeds.filter((s) => s >= p65Val && s <= p97Val);
    cruisingAvg = trimmed.length > 0
      ? Number((trimmed.reduce((a, b) => a + b, 0) / trimmed.length).toFixed(1))
      : calcPercentile(movingSpeeds, 80);
  }

  // 2. 算法 3：时序稳态段提取（连续 >= 20s 稳速，标准差 <= 2.5 km/h）
  const sortedByTime = [...validPoints].sort((a, b) => (a.t || 0) - (b.t || 0));
  const sustainedSegments: MinimalPoint[][] = [];
  let currentSeg: MinimalPoint[] = [];

  const flushSegment = (seg: MinimalPoint[]) => {
    if (seg.length >= 3) {
      const durationSec = ((seg[seg.length - 1].t || 0) - (seg[0].t || 0)) / 1000.0;
      if (durationSec >= 20.0) {
        const segSpeeds = seg.map((x) => x.sp || 0);
        const mean = segSpeeds.reduce((a, b) => a + b, 0) / segSpeeds.length;
        const variance = segSpeeds.reduce((a, b) => a + (b - mean) ** 2, 0) / segSpeeds.length;
        if (Math.sqrt(variance) <= 2.5) {
          sustainedSegments.push([...seg]);
        }
      }
    }
  };

  for (const p of sortedByTime) {
    const sp = p.sp || 0;
    if (sp >= 18.0) {
      if (currentSeg.length > 0) {
        const lastSp = currentSeg[currentSeg.length - 1].sp || 0;
        if (Math.abs(sp - lastSp) > 3.0) {
          flushSegment(currentSeg);
          currentSeg = [];
        }
      }
      currentSeg.push(p);
    } else {
      flushSegment(currentSeg);
      currentSeg = [];
    }
  }
  flushSegment(currentSeg);

  const allSustainedSpeeds = sustainedSegments.flatMap((seg) => seg.map((p) => p.sp || 0));
  const sustainedAvg = allSustainedSpeeds.length > 0
    ? Number((allSustainedSpeeds.reduce((a, b) => a + b, 0) / allSustainedSpeeds.length).toFixed(1))
    : Number((cruisingAvg - 2.0).toFixed(1));

  // 3. 速度分层耗时分布
  let pausedCount = 0;
  let lowCount = 0;
  let tempoCount = 0;
  let cruiseCount = 0;
  let sprintCount = 0;

  for (const p of validPoints) {
    const sp = p.sp || 0;
    if (sp < 2.0) pausedCount++;
    else if (sp < 15.0) lowCount++;
    else if (sp < 22.0) tempoCount++;
    else if (sp < 30.0) cruiseCount++;
    else sprintCount++;
  }

  const speedLoss = Number(Math.max(0, cruisingAvg - fallbackMovingAvgKmh).toFixed(1));
  const derivedCadence = deriveCadenceFromSpeed(cruisingAvg, chainring, cog);

  return {
    has_detail: true,
    cruising_avg_speed_kmh: cruisingAvg,
    cruising_range_kmh: [p75, p90],
    speed_loss_kmh: speedLoss,
    speed_loss_pct: Math.round((speedLoss / cruisingAvg) * 100),
    sustained_segments_count: sustainedSegments.length,
    sustained_avg_speed_kmh: sustainedAvg,
    derived_cadence_rpm: derivedCadence,
    cadence_zone_status: derivedCadence >= 85 && derivedCadence <= 95 ? 'golden' : derivedCadence < 85 ? 'low' : 'high',
    speed_tiers: {
      paused_secs: pausedCount,
      paused_pct: Math.round((pausedCount / totalCount) * 100),
      low_speed_secs: lowCount,
      low_speed_pct: Math.round((lowCount / totalCount) * 100),
      tempo_secs: tempoCount,
      tempo_pct: Math.round((tempoCount / totalCount) * 100),
      cruising_secs: cruiseCount,
      cruising_pct: Math.round((cruiseCount / totalCount) * 100),
      sprint_secs: sprintCount,
      sprint_pct: Math.round((sprintCount / totalCount) * 100),
    },
    summary_text: `稳态平路巡航 ${cruisingAvg} km/h (${p75}-${p90} km/h), 46/15T 踏频 ${derivedCadence} rpm, 速度损耗 ${speedLoss} km/h (${Math.round((speedLoss / cruisingAvg) * 100)}%)`,
  };
}

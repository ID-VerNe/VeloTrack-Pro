/**
 * VeloTrack 前端 reportService
 *
 * 从 packages/api/src/services/reportService.ts 平移。
 * 周期汇总聚合：前端拉全量 rides 后本地做 SUM/COUNT + 环比 + timeline 拆解。
 * 后端不再提供 reports/summary（第一版返回 501），全部前端算。
 */

import { getPeriodBoundaries, type PeriodType } from '../utils/dateUtils';
import { getRiderProfile } from './riderService';
import { calculateCyclingCalories, calculateDualSpeeds } from '../utils/cyclingCalculations';

export interface PeriodicSummaryResult {
  period_type: PeriodType;
  start_time: number;
  end_time: number;
  summary: {
    total_distance_km: number;
    prev_distance_km: number;
    distance_change_pct: number;
    moving_time_seconds: number;
    elapsed_time_seconds: number;
    paused_time_seconds: number;
    moving_ratio_pct: number;
    prev_time_seconds: number;
    time_change_pct: number;
    total_ascent_meters: number;
    prev_ascent_meters: number;
    ascent_change_pct: number;
    avg_speed_kmh: number;
    moving_avg_speed_kmh: number;
    elapsed_avg_speed_kmh: number;
    prev_avg_speed_kmh: number;
    avg_speed_change_pct: number;
    max_speed_kmh: number;
    calories: number;
    rides_count: number;
    prev_rides_count: number;
    active_days_count: number;
  };
  timeline: {
    labels: string[];
    distance: number[];
    ascent: number[];
  };
  rides: Array<{
    id: string;
    title: string;
    start_time: number;
    distance_km: number;
    moving_time_seconds: number;
    elapsed_time_seconds: number;
    paused_time_seconds: number;
    moving_avg_speed_kmh: number;
    elapsed_avg_speed_kmh: number;
    avg_speed_kmh: number;
    max_speed_kmh: number;
    total_ascent_meters: number;
  }>;
}

export function estimateCyclingCalories(
  totalMovingSecs: number,
  avgSpeedKmh: number,
  totalAscentMeters: number,
  riderWeightKg = 75
): number {
  return calculateCyclingCalories(0, totalMovingSecs, avgSpeedKmh, totalAscentMeters, riderWeightKg);
}

export async function computePeriodicSummary(
  type: PeriodType,
  timestamp = Date.now()
): Promise<PeriodicSummaryResult> {
  const boundaries = getPeriodBoundaries(type, timestamp);
  const rider = await getRiderProfile();

  // 前端拉全量 rides，本地按时间窗过滤
  const allRes = await fetch('/api/rides');
  const allRides: any[] = allRes.ok ? (await allRes.json()).rides || [] : [];

  const currentRides = allRides.filter(
    (r) => r.start_time >= boundaries.currentStart && r.start_time <= boundaries.currentEnd
  );
  const prevRides = allRides.filter(
    (r) => r.start_time >= boundaries.prevStart && r.start_time <= boundaries.prevEnd
  );

  const totalDistMeters = currentRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0);
  const totalMovingSecs = currentRides.reduce((acc, r) => acc + (r.moving_time_seconds || r.elapsed_time_seconds || 0), 0);
  const totalElapsedSecs = currentRides.reduce((acc, r) => acc + (r.elapsed_time_seconds || r.moving_time_seconds || 0), 0);

  const {
    movingAvgSpeedKmh,
    elapsedAvgSpeedKmh,
    pausedTimeSeconds: totalPausedSecs,
    movingRatioPct,
  } = calculateDualSpeeds(totalDistMeters, totalMovingSecs, totalElapsedSecs);

  const totalAscentMeters = currentRides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0);
  const maxSpeedKmh = currentRides.reduce((acc, r) => Math.max(acc, r.max_speed_kmh || 0), 0);

  const activeDaysSet = new Set(currentRides.map((r) => new Date(r.start_time).toDateString()));

  const prevDistMeters = prevRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0);
  const prevMovingSecs = prevRides.reduce((acc, r) => acc + (r.moving_time_seconds || r.elapsed_time_seconds || 0), 0);
  const prevAscentMeters = prevRides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0);
  const prevAvgSpeedKmh = prevMovingSecs > 0 ? (prevDistMeters / 1000) / (prevMovingSecs / 3600) : 0;

  const distChangePct = prevDistMeters > 0 ? Number((((totalDistMeters - prevDistMeters) / prevDistMeters) * 100).toFixed(1)) : 0;
  const timeChangePct = prevMovingSecs > 0 ? Number((((totalMovingSecs - prevMovingSecs) / prevMovingSecs) * 100).toFixed(1)) : 0;
  const ascentChangePct = prevAscentMeters > 0 ? Number((((totalAscentMeters - prevAscentMeters) / prevAscentMeters) * 100).toFixed(1)) : 0;
  const speedChangePct = prevAvgSpeedKmh > 0 ? Number((((movingAvgSpeedKmh - prevAvgSpeedKmh) / prevAvgSpeedKmh) * 100).toFixed(1)) : 0;

  const calories = estimateCyclingCalories(totalMovingSecs, movingAvgSpeedKmh, totalAscentMeters, rider.weight_kg || 75);

  // Timeline breakdown
  const timelineLabels: string[] = [];
  const timelineDistance: number[] = [];
  const timelineAscent: number[] = [];

  if (type === 'week') {
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    for (let i = 0; i < 7; i++) {
      const dayStart = boundaries.currentStart + i * 24 * 3600 * 1000;
      const dayEnd = dayStart + 24 * 3600 * 1000 - 1;
      const dayRides = currentRides.filter((r) => r.start_time >= dayStart && r.start_time <= dayEnd);
      timelineLabels.push(dayNames[i]);
      timelineDistance.push(Number((dayRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0) / 1000).toFixed(1)));
      timelineAscent.push(dayRides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0));
    }
  } else if (type === 'month') {
    for (let i = 0; i < 4; i++) {
      const wStart = boundaries.currentStart + i * 7 * 24 * 3600 * 1000;
      const wEnd = i === 3 ? boundaries.currentEnd : wStart + 7 * 24 * 3600 * 1000 - 1;
      const wRides = currentRides.filter((r) => r.start_time >= wStart && r.start_time <= wEnd);
      timelineLabels.push(`第 ${i + 1} 周`);
      timelineDistance.push(Number((wRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0) / 1000).toFixed(1)));
      timelineAscent.push(wRides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0));
    }
  } else if (type === 'half_year') {
    const curDate = new Date(boundaries.currentStart);
    for (let i = 0; i < 6; i++) {
      const m = (curDate.getMonth() + i) % 12;
      const mYear = curDate.getFullYear() + Math.floor((curDate.getMonth() + i) / 12);
      const mStart = new Date(mYear, m, 1, 0, 0, 0).getTime();
      const mEnd = new Date(mYear, m + 1, 0, 23, 59, 59).getTime();
      const mRides = currentRides.filter((r) => r.start_time >= mStart && r.start_time <= mEnd);
      timelineLabels.push(`${m + 1}月`);
      timelineDistance.push(Number((mRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0) / 1000).toFixed(1)));
      timelineAscent.push(mRides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0));
    }
  } else {
    const year = new Date(boundaries.currentStart).getFullYear();
    for (let m = 0; m < 12; m++) {
      const mStart = new Date(year, m, 1, 0, 0, 0).getTime();
      const mEnd = new Date(year, m + 1, 0, 23, 59, 59).getTime();
      const mRides = currentRides.filter((r) => r.start_time >= mStart && r.start_time <= mEnd);
      timelineLabels.push(`${m + 1}月`);
      timelineDistance.push(Number((mRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0) / 1000).toFixed(1)));
      timelineAscent.push(mRides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0));
    }
  }

  return {
    period_type: type,
    start_time: boundaries.currentStart,
    end_time: boundaries.currentEnd,
    summary: {
      total_distance_km: Number((totalDistMeters / 1000).toFixed(1)),
      prev_distance_km: Number((prevDistMeters / 1000).toFixed(1)),
      distance_change_pct: distChangePct,
      moving_time_seconds: totalMovingSecs,
      elapsed_time_seconds: totalElapsedSecs,
      paused_time_seconds: totalPausedSecs,
      moving_ratio_pct: movingRatioPct,
      prev_time_seconds: prevMovingSecs,
      time_change_pct: timeChangePct,
      total_ascent_meters: totalAscentMeters,
      prev_ascent_meters: prevAscentMeters,
      ascent_change_pct: ascentChangePct,
      avg_speed_kmh: movingAvgSpeedKmh,
      moving_avg_speed_kmh: movingAvgSpeedKmh,
      elapsed_avg_speed_kmh: elapsedAvgSpeedKmh,
      prev_avg_speed_kmh: Number(prevAvgSpeedKmh.toFixed(1)),
      avg_speed_change_pct: speedChangePct,
      max_speed_kmh: Number(maxSpeedKmh.toFixed(1)),
      calories,
      rides_count: currentRides.length,
      prev_rides_count: prevRides.length,
      active_days_count: activeDaysSet.size,
    },
    timeline: { labels: timelineLabels, distance: timelineDistance, ascent: timelineAscent },
    rides: currentRides.map((r) => {
      const mSec = r.moving_time_seconds || r.elapsed_time_seconds || 0;
      const eSec = r.elapsed_time_seconds || r.moving_time_seconds || 0;
      const dKm = (r.distance_meters || 0) / 1000;
      return {
        id: r.id,
        title: r.title,
        start_time: r.start_time,
        distance_km: Number(dKm.toFixed(1)),
        moving_time_seconds: mSec,
        elapsed_time_seconds: eSec,
        paused_time_seconds: Math.max(0, eSec - mSec),
        moving_avg_speed_kmh: mSec > 0 ? Number((dKm / (mSec / 3600)).toFixed(1)) : 0,
        elapsed_avg_speed_kmh: eSec > 0 ? Number((dKm / (eSec / 3600)).toFixed(1)) : 0,
        avg_speed_kmh: mSec > 0 ? Number((dKm / (mSec / 3600)).toFixed(1)) : 0,
        max_speed_kmh: r.max_speed_kmh || 0,
        total_ascent_meters: r.total_ascent_meters || 0,
      };
    }),
  };
}

/**
 * 周期 AI 复盘：调 Gateway 生成。
 * 从 packages/api/src/routes/reports.ts 的 /insight 平移。
 */
export async function generatePeriodInsight(
  type: PeriodType,
  summary: PeriodicSummaryResult['summary'],
  ridesCount: number
): Promise<string> {
  const { getAIConfig, callAICompletion, parseAIResponse } = await import('./aiClient');
  const { getRiderContextPrompt } = await import('./riderService');

  const config = await getAIConfig();
  const riderContext = await getRiderContextPrompt();

  const typeNames: Record<string, string> = {
    week: '周度', month: '月度', half_year: '半年度', year: '年度',
  };
  const typeLabel = typeNames[type] || '周期';

  const systemPrompt = `你是由世界顶级自行车职业车队运动表现总监与运动生理学专家联合调校的 **VeloTrack 专属周期训练顾问**。
你的职责是结合车手的【专属档案背景、战车配置与历史伤病记忆】，对车手的【${typeLabel}训练数据、双均速与环比趋势】进行深入、系统性的运动生理与负荷诊断，并给出下一阶段清晰的周期性课表。

${riderContext}

【必须严格按以下三大板块输出（不可缺少任何一个板块）】：

### 周期负荷与完成度评估
（深入评价本${typeLabel}的总里程 ${summary.total_distance_km}km、有效运动时间 ${(summary.moving_time_seconds / 3600).toFixed(1)}小时、停顿时间 ${(summary.paused_time_seconds / 3600).toFixed(1)}小时、总爬升 ${summary.total_ascent_meters}m、活动频次与环比增减情况，评估体能增长与耐力储备）

### 踏频节奏与体能/膝盖恢复诊断
（结合战车46T/11-28T 7速齿比、【停表纯骑行均速 ${summary.moving_avg_speed_kmh || summary.avg_speed_kmh}km/h】与【总均速 ${summary.elapsed_avg_speed_kmh || summary.avg_speed_kmh}km/h】，重点分析踩踏做功效率与右膝半月板受力防护，诊断疲劳积累情况）

### 下一周期针对性训练课表
（根据车手核心训练目标，给出下一周期的具体阶段性训练指导：包括高踏频有氧基底训练、爬坡齿比建议与恢复安排）

输出要求：语言专业、客观深刻、鼓舞人心，总字数约 400-600 字。`;

  const userPrompt = `车手本${typeLabel}骑行总结数据：
- 周期类型: ${typeLabel}总结
- 累计骑行里程: ${summary.total_distance_km} 公里 (环比上一周期变化: ${summary.distance_change_pct > 0 ? '+' : ''}${summary.distance_change_pct}%)
- 累计运动时间: ${(summary.moving_time_seconds / 3600).toFixed(1)} 小时 (门到门总历时: ${(summary.elapsed_time_seconds / 3600).toFixed(1)} 小时，累计停顿: ${(summary.paused_time_seconds / 3600).toFixed(1)} 小时，有效踩踏占比: ${summary.moving_ratio_pct}%)
- 周期加权【停表纯骑行均速】: ${summary.moving_avg_speed_kmh || summary.avg_speed_kmh} km/h (纯踩踏效率)
- 周期综合【总均速】: ${summary.elapsed_avg_speed_kmh || summary.avg_speed_kmh} km/h
- 累计爬升做功: ${summary.total_ascent_meters} 米 (环比: ${summary.ascent_change_pct > 0 ? '+' : ''}${summary.ascent_change_pct}%)
- 最高瞬时冲刺: ${summary.max_speed_kmh} km/h
- 消耗能量估计: ${summary.calories} kcal
- 完成骑行活动: ${ridesCount} 次，活跃天数: ${summary.active_days_count} 天

请结合我的个人生理档案与既往记忆，为我生成一份权威、个性化的${typeLabel}运动表现复盘报告与下阶段课表。`;

  const res = await callAICompletion(config, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { temperature: 0.3, max_tokens: 3000 });

  const { content } = await parseAIResponse(res);
  return content || '未能生成周期分析报告。';
}

/**
 * VeloTrack 车手 Agentic 上下文与 Prompt 组装引擎
 * 
 * 职责：汇聚车手基础画像、训练目标、演进里程碑、记忆切片与遥测真实数据，
 * 组装供给 AI Coach / AI Insights 的结构化上下文提示词。
 */

import { analyzeSpeedDistribution } from '../utils/speedDistribution';
import { calculateDualSpeeds } from '../utils/cyclingCalculations';
import {
  getRiderProfile,
  getRiderMemories,
  getTrainingGoals,
  getGoalMilestones,
} from './riderService';

/**
 * Tiered Agentic Memory Prompt Assembly Engine
 * 拉取全量 rides 做双均速聚合，并格式化为标准 Prompt
 */
export async function getRiderContextPrompt(): Promise<string> {
  const profile = await getRiderProfile();
  const memories = await getRiderMemories(true);
  const goals = await getTrainingGoals();
  const milestones = await getGoalMilestones(2);

  const ridesRes = await fetch('/api/rides');
  const ridesData = ridesRes.ok ? await ridesRes.json() : { rides: [] };
  const rides: any[] = ridesData.rides || [];

  const totalDistMeters = rides.reduce((acc, r) => acc + (r.distance_meters || 0), 0);
  const totalDistKm = Number((totalDistMeters / 1000).toFixed(1));
  const totalAscentM = rides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0);

  const totalMovingSec = rides.reduce((acc, r) => acc + (r.moving_time_seconds || r.elapsed_time_seconds || 0), 0);
  const totalElapsedSec = rides.reduce((acc, r) => acc + (r.elapsed_time_seconds || r.moving_time_seconds || 0), 0);

  const {
    movingAvgSpeedKmh: overallMovingAvgSpeed,
    elapsedAvgSpeedKmh: overallElapsedAvgSpeed,
    pausedTimeSeconds: totalPausedSec,
    movingRatioPct: totalMovingRatioPct,
  } = calculateDualSpeeds(totalDistMeters, totalMovingSec, totalElapsedSec);

  const totalMovingHours = Number((totalMovingSec / 3600).toFixed(1));
  const totalElapsedHours = Number((totalElapsedSec / 3600).toFixed(1));
  const totalPausedHours = Number((totalPausedSec / 3600).toFixed(1));

  const bestMovingAvgSpeed = rides.reduce((acc, r) => {
    const mSec = r.moving_time_seconds || r.elapsed_time_seconds || 0;
    const spd = mSec > 0 ? ((r.distance_meters || 0) / 1000) / (mSec / 3600) : 0;
    return Math.max(acc, Number(spd.toFixed(1)));
  }, 0);

  const maxSprint = rides.reduce((acc, r) => Math.max(acc, r.max_speed_kmh || 0), 0);
  const longestRide = rides.reduce((acc, r) => Math.max(acc, (r.distance_meters || 0) / 1000), 0);

  const latestRideTime = Math.max(...rides.map((r) => r.start_time || 0), 0);
  const refDate = new Date(latestRideTime > 0 ? latestRideTime : Date.now());
  const day = refDate.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  const weekRides = rides.filter((r) => r.start_time >= monday.getTime() && r.start_time < sunday.getTime());
  const thisWeekDistMeters = weekRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0);
  const thisWeekKm = Number((thisWeekDistMeters / 1000).toFixed(1));
  const thisWeekMovingSec = weekRides.reduce((acc, r) => acc + (r.moving_time_seconds || r.elapsed_time_seconds || 0), 0);
  const thisWeekElapsedSec = weekRides.reduce((acc, r) => acc + (r.elapsed_time_seconds || r.moving_time_seconds || 0), 0);

  const {
    movingAvgSpeedKmh: thisWeekMovingSpeed,
    elapsedAvgSpeedKmh: thisWeekElapsedSpeed,
    pausedTimeSeconds: thisWeekPausedSec,
  } = calculateDualSpeeds(thisWeekDistMeters, thisWeekMovingSec, thisWeekElapsedSec);

  const weeklyCompletionPct = Math.round((thisWeekKm / goals.weekly_distance_km) * 100);
  const speedCompletionPct = Math.round((bestMovingAvgSpeed / goals.target_avg_speed_kmh) * 100);

  const healthMemories = memories.filter((m) => m.category === 'health' || m.category === 'physiology');
  const gearMemories = memories.filter((m) => m.category === 'gear');
  const habitMemories = memories.filter((m) => m.category === 'habit' || m.category === 'preference' || m.category === 'coaching');

  let semanticFactsSection = '';
  if (healthMemories.length > 0) {
    semanticFactsSection += `  - 【健康与伤病底线】:\n` + healthMemories.map((m) => `    * ${m.content}`).join('\n') + '\n';
  }
  if (gearMemories.length > 0) {
    semanticFactsSection += `  - 【战车调校经验】:\n` + gearMemories.map((m) => `    * ${m.content}`).join('\n') + '\n';
  }
  if (habitMemories.length > 0) {
    semanticFactsSection += `  - 【习惯与偏好画像】:\n` + habitMemories.map((m) => `    * ${m.content}`).join('\n') + '\n';
  }

  let milestoneSection = '';
  if (milestones.length > 0) {
    milestoneSection = `【阶段目标演进轨迹 (近期里程碑记录)】:\n` +
      milestones.map((m) => `  - [${new Date((m.created_at || Date.now() / 1000) * 1000).toLocaleDateString('zh-CN')}] 单周 ${m.weekly_distance_km}km / 巡航停表均速 ${m.target_avg_speed_kmh}km/h (理由: ${m.rationale})`).join('\n') + '\n\n';
  }

  let cruisingSection = '';
  try {
    let detailPoints: any = null;
    if (rides.length > 0) {
      const latestRes = await fetch(`/api/rides/${rides[0].id}`);
      if (latestRes.ok) {
        const latestData = await latestRes.json();
        detailPoints = latestData.detailPoints;
      }
    }
    const recentMovingAvg = (weekRides.length > 0 && thisWeekMovingSpeed > 0)
      ? thisWeekMovingSpeed
      : (overallMovingAvgSpeed > 0 ? overallMovingAvgSpeed : 18.0);
    const speedDist = analyzeSpeedDistribution(detailPoints, recentMovingAvg, 46, 15);

    cruisingSection = `\n\n【真实运动学速度分层与稳态巡航特征（核心巡航与踏频事实）】：
- ⚡ 稳态平路巡航时速 (Cruising Speed): ${speedDist.cruising_avg_speed_kmh} km/h (P75-P90 核心巡航区间: ${speedDist.cruising_range_kmh[0]} - ${speedDist.cruising_range_kmh[1]} km/h)
- ⚙️ 46/15T 主力档位物理反推踩踏踏频: ${speedDist.derived_cadence_rpm} rpm (${speedDist.cadence_zone_status === 'golden' ? '✅ 完全处于 85-95 rpm 黄金高效有氧保护区间，齿比与踏频匹配极佳，绝非重档死蹬' : `${speedDist.derived_cadence_rpm} rpm`})
- ⏱️ 综合停表均速 (Moving Avg Speed): ${recentMovingAvg} km/h
- 🚦 速度落差与红绿灯/起步损耗 (Speed Loss): ${speedDist.speed_loss_kmh} km/h (落差占比: ${speedDist.speed_loss_pct}%)
- ⏱️ 时序持续稳态段落 (算法 3 提取): 成功维持 ${speedDist.sustained_segments_count} 段连续 >=20s 稳速巡航 (平均稳态速度: ${speedDist.sustained_avg_speed_kmh} km/h)
- 📊 速度时间分布占比: 停顿/红绿灯 (<2km/h) ${speedDist.speed_tiers.paused_pct}%, 低速起步/控车 (2-15km/h) ${speedDist.speed_tiers.low_speed_pct}%, 节奏过渡 (15-22km/h) ${speedDist.speed_tiers.tempo_pct}%, 稳态巡航 (22-30km/h) ${speedDist.speed_tiers.cruising_pct}%, 高速冲刺 (>=30km/h) ${speedDist.speed_tiers.sprint_pct}%
- 💡 教练执教铁律：评估车手踩踏踏频、齿比匹配度与膝盖受力时，必须以【稳态平路巡航时速 ${speedDist.cruising_avg_speed_kmh} km/h】为基准！【综合停表均速 ${recentMovingAvg} km/h】仅用于分析红绿灯起步与路线通畅度损耗。`;
  } catch (e) {
    console.error('Failed to compute cruising speed in getRiderContextPrompt', e);
  }

  return `【车手专属生理与战车基底档案】：
- 车手: ${profile.name}（性别: ${profile.gender === 'female' ? '女' : '男'}，体重: ${profile.weight_kg}kg，身高: ${profile.height_cm}cm）
- 生理基准: 最大心率 ${profile.max_hr} bpm, 静息心率 ${profile.resting_hr} bpm, FTP: ${profile.ftp_watts} W
- 主力战车: ${profile.current_bike} (净重 ${profile.bike_weight_kg || 11.5} kg)
- 齿比与外胎: ${profile.gear_ratio || '46T牙盘 + 11-28T 7速飞轮'} · ${profile.tires || '马牌 Contact Urban 2.0 轮胎 (75-80 psi)'}
- 器材综合配置: ${profile.bike_specs}
- 伤病概况: ${profile.injuries_notes || '暂无急性伤病'}

【系统当前生效量化目标】：
- 单周目标里程: ${goals.weekly_distance_km} km (本周已完成: ${thisWeekKm} km, 完成度: ${weeklyCompletionPct}%)
- 目标【停表巡航均速】: ${goals.target_avg_speed_kmh} km/h (历史最佳单次停表均速: ${bestMovingAvgSpeed} km/h, 达标率: ${speedCompletionPct}%)
- 单月目标: ${goals.monthly_distance_km} km · 年度目标: ${goals.annual_distance_km} km (累计完成: ${totalDistKm} km)
- 当前教练策略: "${goals.coach_notes}"

【车手长期语义记忆与偏好画像 (已沉淀原子事实)】:
${semanticFactsSection || '  - 暂无特殊偏好记录，以标准高踏频防伤膝原则执教。\n'}
${milestoneSection}【车手真实数据库近期实战状态（双均速与踩踏做功）】：
- 历史总记录: ${rides.length} 次骑行，累计里程: ${totalDistKm} km，累计爬升: ${totalAscentM} m
- 累计纯运动踩踏: ${totalMovingHours} 小时，累计门到门历时: ${totalElapsedHours} 小时，累计停顿: ${totalPausedHours} 小时 (做功占比: ${totalMovingRatioPct}%)
- 历史整体【停表运动均速】: ${overallMovingAvgSpeed} km/h · 历史整体【总历时均速】: ${overallElapsedAvgSpeed} km/h
- 历史最佳【停表均速】: ${bestMovingAvgSpeed} km/h · 冲刺最高极速: ${maxSprint.toFixed(1)} km/h · 最长单次: ${longestRide.toFixed(1)} km
- 本周实战数据: ${weekRides.length} 次骑行，累计 ${thisWeekKm} km。纯运动时间 ${(thisWeekMovingSec / 60).toFixed(1)} 分，停顿 ${(thisWeekPausedSec / 60).toFixed(1)} 分。本周【停表均速】: ${thisWeekMovingSpeed} km/h，【总均速】: ${thisWeekElapsedSpeed} km/h
- 近期身体适应度: 【良好·具备进阶潜力】（右膝无急性剧痛报告，高踏频打磨中）${cruisingSection}`;
}

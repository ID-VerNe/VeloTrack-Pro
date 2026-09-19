/**
 * VeloTrack 前端 aiInsights 服务
 *
 * 从 packages/api/src/routes/aiInsights.ts 平移。
 * 单次骑行深度生理复盘：读 ride → 物理引擎确定性计算 → 调 AI → 缓存。
 * insight 缓存存后端 ride_insights 表（content_hash 校验，未变化直接返回缓存）。
 */

import { getAIConfig, callAICompletion, sha256, parseAIResponse } from './aiClient';
import { getRiderProfile, getRiderContextPrompt } from './riderService';
import { calculateDualSpeeds } from '../utils/cyclingCalculations';
import {
  calculateClimbingPower,
  calculateGearCadenceSpeed,
  calculateHeartRateZones,
} from '../utils/cyclingPhysicsEngine';
import { analyzeSpeedDistribution } from '../utils/speedDistribution';

export interface RideInsightResult {
  insight: string;
  cached: boolean;
  warning?: string;
}

export async function getRideInsight(rideId: string, force = false): Promise<RideInsightResult> {
  // 1. 取骑行主记录
  const rideRes = await fetch(`/api/rides/${rideId}`);
  if (!rideRes.ok) {
    throw new Error('加载骑行数据失败：HTTP ' + rideRes.status);
  }
  const rideData = await rideRes.json();
  const ride: any = rideData.ride;
  const detailPoints: any = rideData.detailPoints;
  if (!ride) throw new Error('骑行记录不存在');

  const profile = await getRiderProfile();

  const distKm = ((ride.distance_meters || 0) / 1000).toFixed(2);
  const {
    movingAvgSpeedKmh,
    elapsedAvgSpeedKmh,
    movingTimeSeconds: movingSec,
    elapsedTimeSeconds: elapsedSec,
    pausedTimeSeconds: pausedSec,
  } = calculateDualSpeeds(
    ride.distance_meters || 0,
    ride.moving_time_seconds,
    ride.elapsed_time_seconds
  );

  const movingMins = (movingSec / 60).toFixed(1);
  const elapsedMins = (elapsedSec / 60).toFixed(1);
  const pausedMins = (pausedSec / 60).toFixed(1);

  // 速度分层与稳态巡航特征提取
  const speedDist = analyzeSpeedDistribution(detailPoints, movingAvgSpeedKmh, 46, 15);
  const cruisingSpeedKmh = speedDist.cruising_avg_speed_kmh;

  // 2. 确定性物理计算
  const climbResult = calculateClimbingPower({
    riderWeightKg: profile.weight_kg || 75,
    bikeWeightKg: profile.bike_weight_kg || 11.5,
    ascentMeters: ride.total_ascent_meters || 0,
    movingTimeSeconds: movingSec,
    ftpWatts: profile.ftp_watts || 165,
  });

  const gearResult = calculateGearCadenceSpeed({
    chainring: 46,
    cogs: [11, 13, 15, 17, 19, 21, 24, 28],
    wheelSpec: '20x2.0',
    targetSpeedKmh: cruisingSpeedKmh,
  });

  const hrResult = calculateHeartRateZones({
    maxHr: profile.max_hr || 188,
    restingHr: profile.resting_hr || 55,
    currentAvgHr: ride.avg_heart_rate,
  });

  // 3. content_hash 校验缓存
  // 近 7 天负荷：前端拉全量 rides 本地过滤（/api/rides 不支持 since/until 参数）
  const sevenDaysAgo = ride.start_time - 7 * 24 * 3600 * 1000;
  let recentDistKm = '0';
  let recentCount = 1;
  try {
    const allRes = await fetch('/api/rides');
    if (allRes.ok) {
      const allData = await allRes.json();
      const recentRides = (allData.rides || []).filter(
        (r: any) => r.start_time >= sevenDaysAgo && r.start_time <= ride.start_time
      );
      recentCount = recentRides.length || 1;
      recentDistKm = (recentRides.reduce((acc: number, r: any) => acc + (r.distance_meters || 0), 0) / 1000).toFixed(1);
    }
  } catch (e) {
    console.error('Failed to load recent rides for insight hash', e);
  }

  const contentString = `${ride.id}|${distKm}|${movingAvgSpeedKmh}|${elapsedAvgSpeedKmh}|${ride.max_speed_kmh}|${ride.total_ascent_meters}|${movingMins}|${pausedMins}|${recentDistKm}|${recentCount}`;
  const contentHash = await sha256(contentString);

  // 4. 取缓存
  if (!force) {
    const cacheRes = await fetch(`/api/ai/rides/${rideId}/insight`);
    if (cacheRes.ok) {
      const cache = await cacheRes.json();
      if (
        cache.cached &&
        cache.insight &&
        cache.content_hash === contentHash &&
        cache.insight.length > 350 &&
        cache.insight.includes('配速') &&
        cache.insight.includes('地形') &&
        cache.insight.includes('建议')
      ) {
        return { insight: cache.insight, cached: true };
      }
    }
  }

  // 5. 调 AI 生成
  const config = await getAIConfig();
  const riderContext = await getRiderContextPrompt();

  const systemPrompt = `你是由世界顶级自行车职业车队运动生理学家与专业教练联合调校的 VeloTrack 专属训练顾问。
你的核心职责是结合车手的【专属档案背景、器材配置与历史伤病记忆】，以及系统物理引擎计算出的【权威运动学做功事实】，对本次骑行数据进行高度个性化、因人制宜的专业生理诊断与复盘。

${riderContext}

【必须完整输出以下三大核心板块（严禁漏掉任何一个板块）】：

### 配速与骑行节奏分析
（严格解耦【稳态平路巡航时速】与【综合停表均速】。肯定车手在稳态巡航时保持 46/15T @ 88-95 rpm 的科学黄金踏频与膝盖保护，绝非重档死蹬。详细分析低速起步与红绿灯造成的速度损耗落差，给出红绿灯起步提前降轻档提频、平路进入巡航后再挂 46/15T 的专业控速指导）

### 地形适应与体能消耗
（必须直接引用物理引擎计算的【重力势能做功与爬升均摊功率】，重点分析右膝半月板受力与防劳损保护情况，结合 Karvonen 生理区间评估有氧负荷）

### 下阶段训练与恢复建议
（结合车手阶段目标，给出 2-3 条明确、可落地的单次训练目标：如平路高踏频专项、齿比选择与恢复注意事项）

输出要求：语言专业、客观严谨，必须完整输出上述全部 3 个板块，总字数约 350-500 字。`;

  const userPrompt = `本次骑行活动遥测数据与【物理引擎确定性计算事实】：
- 活动名称: ${ride.title}
- 骑行日期: ${new Date(ride.start_time).toLocaleString('zh-CN')}
- 实际总里程: ${distKm} 公里
- 纯运动时间: ${movingMins} 分钟
- 总历时时间: ${elapsedMins} 分钟（含停顿/红绿灯 ${pausedMins} 分钟）
- 稳态平路巡航时速: ${speedDist.cruising_avg_speed_kmh} km/h (P75-P90 核心巡航区间: ${speedDist.cruising_range_kmh[0]} - ${speedDist.cruising_range_kmh[1]} km/h)
- 46/15T 巡航反推踏频: ${speedDist.derived_cadence_rpm} rpm (${speedDist.cadence_zone_status === 'golden' ? '✅ 完全处于 85-95 rpm 黄金高效有氧保护区间，绝非重档死蹬' : `${speedDist.derived_cadence_rpm} rpm`})
- 综合停表均速: ${movingAvgSpeedKmh} km/h (纯踩踏做功均速，受起步与红绿灯拉低)
- 速度落差损耗: ${speedDist.speed_loss_kmh} km/h (损耗占比: ${speedDist.speed_loss_pct}%)
- 综合总均速: ${elapsedAvgSpeedKmh} km/h (门到门总耗时均速)
- 最高冲刺极速: ${ride.max_speed_kmh || 0} km/h
- 累计爬升高度: ${ride.total_ascent_meters || 0} 米
- 速度分层耗时占比: 停顿 ${speedDist.speed_tiers.paused_pct}%, 低速起步 ${speedDist.speed_tiers.low_speed_pct}%, 节奏过渡 ${speedDist.speed_tiers.tempo_pct}%, 稳态巡航 ${speedDist.speed_tiers.cruising_pct}%, 冲刺极速 ${speedDist.speed_tiers.sprint_pct}%
- 【物理引擎 - 爬坡做功】: 克服重力势能做功约 ${climbResult.gravity_work_kj} kJ，爬升均摊功率约 ${climbResult.gravity_power_watts} W (${climbResult.gravity_w_per_kg} W/kg，约占 FTP ${climbResult.ftp_percentage || 16}%)，负荷评级: ${climbResult.intensity_rating}
- 【物理引擎 - 齿比匹配】: 稳态巡航 ${cruisingSpeedKmh}km/h 最优档位推荐: ${gearResult.recommended_cruising_cog?.cog ? `46/${gearResult.recommended_cruising_cog.cog}T (@ ${gearResult.recommended_cruising_cog.required_cadence_rpm} rpm)` : '46/15T 或 46/17T'}
- 【物理引擎 - 心率区间】: Zone 2 黄金有氧区间为 ${hrResult.zones.zone2_endurance.min}-${hrResult.zones.zone2_endurance.max} bpm
- 近 7 天训练负荷: 完成 ${recentCount} 次骑行，累计 ${recentDistKm} 公里。

请结合我的个人车手档案与物理计算事实，为我生成本次完整的专属三板块生理复盘。`;

  const res = await callAICompletion(config, [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ], { temperature: 0.3, max_tokens: 6000, reasoning_effort: 'none' });

  let { content: insight } = await parseAIResponse(res);
  if (!insight) insight = '未能生成完整分析报告。';

  // 输出不全时重试一次
  if (!insight.includes('地形') || !insight.includes('建议') || insight.length < 300) {
    const retryRes = await callAICompletion(config, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt + '\n\n【重要】：请务必完整输出「配速与骑行节奏分析」、「地形适应与体能消耗」、「下阶段训练与恢复建议」三大完整段落！' }
    ], { temperature: 0.2, max_tokens: 6000, reasoning_effort: 'none' });
    const retry = await parseAIResponse(retryRes);
    if (retry.content && retry.content.length > insight.length) {
      insight = retry.content;
    }
  }

  // 6. 写缓存
  try {
    await fetch(`/api/ai/rides/${rideId}/insight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_hash: contentHash, insight }),
    });
  } catch (e) {
    console.error('Failed to cache insight', e);
  }

  return { insight, cached: false };
}

/**
 * 确定性规则兜底命名：AI 不可用时依据时间/里程/爬升生成规范中文标题。
 * 从后端 aiInsights.ts 的 generateFallbackRideTitle 平移。
 */
export function generateFallbackRideTitle(data: {
  start_time: number;
  distance_km?: number;
  avg_speed_kmh?: number;
  total_ascent_meters?: number;
  city?: string;
}): string {
  const d = new Date(Number(data.start_time));
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hour = d.getHours();

  let timeSlot = '骑行';
  if (hour >= 5 && hour < 9) timeSlot = '晨骑';
  else if (hour >= 9 && hour < 12) timeSlot = '上午骑行';
  else if (hour >= 12 && hour < 14) timeSlot = '午间骑行';
  else if (hour >= 14 && hour < 18) timeSlot = '下午骑行';
  else if (hour >= 18 && hour < 22) timeSlot = '夜骑';
  else timeSlot = '深夜骑行';

  const dist = Number(data.distance_km) || 0;
  const ascent = Number(data.total_ascent_meters) || 0;
  const city = typeof data.city === 'string' && data.city ? data.city : '';

  let subtype = '';
  if (ascent >= 500) subtype = '爬坡挑战';
  else if (dist >= 50) subtype = '长距离巡航';
  else if (dist >= 30) subtype = '公路巡航';
  else if (dist > 0 && dist < 10) subtype = '短途小试';

  const prefix = city ? `${city} · ` : '';
  const label = subtype ? `${month}月${date}日 ${timeSlot}（${subtype}）` : `${month}月${date}日 ${timeSlot}`;

  return `${prefix}${label}`.slice(0, 24);
}

export async function suggestRideTitle(input: {
  start_time: number;
  distance_km: number;
  avg_speed_kmh: number;
  total_ascent_meters: number;
}): Promise<{ title: string; isFallback?: boolean; warning?: string }> {
  const { start_time, distance_km, avg_speed_kmh, total_ascent_meters } = input;

  if (!Number.isFinite(Number(start_time)) || Number(start_time) <= 0) {
    throw new Error('start_time 必须是有效时间戳');
  }

  const fallback = generateFallbackRideTitle({
    start_time: Number(start_time),
    distance_km,
    avg_speed_kmh,
    total_ascent_meters,
  });

  const config = await getAIConfig();
  if (!config.base_url) {
    return { title: fallback, isFallback: true, warning: 'AI 未配置，已使用规则规范命名' };
  }

  const dateStr = new Date(Number(start_time)).toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'long',
  });

  try {
    const res = await callAICompletion(config, [
      {
        role: 'system',
        content: '你是骑行活动的命名助手。根据骑行数据生成一个简洁的中文标题，不超过 16 个字，直接输出标题本身，不要引号、不要解释、不要 emoji、不要输出思维过程。',
      },
      {
        role: 'user',
        content: JSON.stringify({
          日期: dateStr,
          里程公里: distance_km,
          均速kmh: avg_speed_kmh,
          爬升米: total_ascent_meters,
        }),
      },
    ], { temperature: 0.7, max_tokens: 2000, retries: 1 });

    if (!res.ok) {
      return {
        title: fallback,
        isFallback: true,
        warning: `AI 服务暂时不可用 (HTTP ${res.status})，已启用智能兜底命名`,
      };
    }
    const { content } = await parseAIResponse(res);
    // glm-5.2 会先吐思维链；从 content 中提取首个不含步骤编号/解释的短句作为标题。
    const cleaned = content
      .replace(/^[\s\d.\-、*]+/gm, '')
      .replace(/[（(].*?[)）]/g, '')
      .trim();
    const firstLine = cleaned.split(/\n|。|！|？/).map((s) => s.trim()).find((s) => s.length > 0 && s.length <= 30) || '';
    const rawTitle = (firstLine || content).trim().replace(/^["'“”]+|["'“”]+$/g, '').slice(0, 24);
    return { title: rawTitle || fallback };
  } catch (err) {
    console.error('[suggest-title] Exception, falling back:', err);
    return {
      title: fallback,
      isFallback: true,
      warning: 'AI 服务调用异常，已启用智能兜底命名',
    };
  }
}

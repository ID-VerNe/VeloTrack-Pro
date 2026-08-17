import { Hono } from 'hono';
import type { Bindings } from '../types';
import { ensureTables } from '../services/dbInit';
import { getAIConfig, sha256, callAICompletion } from '../services/aiClient';
import { getRiderProfile, getRiderContextPrompt } from '../services/riderService';
import { 
  calculateClimbingPower, 
  calculateGearCadenceSpeed, 
  calculateHeartRateZones 
} from '../utils/cyclingPhysicsEngine';

export const aiInsightsRouter = new Hono<{ Bindings: Bindings }>();

// 1. 单次骑行深度生理复盘（含双均速、确定性物理做功与停顿时间剖析）
aiInsightsRouter.get('/rides/:id/insight', async (c) => {
  const rideId = c.req.param('id');
  const force = c.req.query('force') === 'true';
  try {
    await ensureTables(c.env.DB);

    const ride = await c.env.DB.prepare('SELECT * FROM rides WHERE id = ?').bind(rideId).first<any>();
    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404);
    }

    const profile = await getRiderProfile(c.env.DB);

    const distKm = (ride.distance_meters / 1000).toFixed(2);
    const movingSec = ride.moving_time_seconds || ride.elapsed_time_seconds || 1;
    const elapsedSec = ride.elapsed_time_seconds || ride.moving_time_seconds || movingSec;
    const pausedSec = Math.max(0, elapsedSec - movingSec);

    const movingMins = (movingSec / 60).toFixed(1);
    const elapsedMins = (elapsedSec / 60).toFixed(1);
    const pausedMins = (pausedSec / 60).toFixed(1);

    const movingAvgSpeedKmh = movingSec > 0 ? Number(((ride.distance_meters / 1000) / (movingSec / 3600)).toFixed(1)) : 0;
    const elapsedAvgSpeedKmh = elapsedSec > 0 ? Number(((ride.distance_meters / 1000) / (elapsedSec / 3600)).toFixed(1)) : 0;

    // 确定性物理与运动学计算 (Deterministic Physics)
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
      targetSpeedKmh: movingAvgSpeedKmh,
    });

    const hrResult = calculateHeartRateZones({
      maxHr: profile.max_hr || 188,
      restingHr: profile.resting_hr || 55,
      currentAvgHr: ride.avg_hr,
    });

    const sevenDaysAgo = ride.start_time - 7 * 24 * 3600 * 1000;
    const recentStats = await c.env.DB.prepare(`
      SELECT COUNT(*) as count, SUM(distance_meters) as total_dist
      FROM rides
      WHERE start_time >= ? AND start_time <= ?
    `).bind(sevenDaysAgo, ride.start_time).first<any>();

    const recentDistKm = ((recentStats?.total_dist || 0) / 1000).toFixed(1);
    const recentCount = recentStats?.count || 1;

    const contentString = `${ride.id}|${distKm}|${movingAvgSpeedKmh}|${elapsedAvgSpeedKmh}|${ride.max_speed_kmh}|${ride.total_ascent_meters}|${movingMins}|${pausedMins}|${recentDistKm}|${recentCount}`;
    const contentHash = await sha256(contentString);

    if (!force) {
      const cachedInsight = await c.env.DB.prepare(
        'SELECT insight, content_hash FROM ride_insights WHERE ride_id = ?'
      ).bind(rideId).first<any>();

      if (
        cachedInsight &&
        cachedInsight.content_hash === contentHash &&
        cachedInsight.insight.length > 350 &&
        cachedInsight.insight.includes('配速') &&
        cachedInsight.insight.includes('地形') &&
        cachedInsight.insight.includes('建议')
      ) {
        return c.json({ insight: cachedInsight.insight, cached: true });
      }
    }

    const config = await getAIConfig(c.env.DB);
    const riderContext = await getRiderContextPrompt(c.env.DB);

    const systemPrompt = `你是由世界顶级自行车职业车队运动生理学家与专业教练联合调校的 VeloTrack 专属训练顾问。
你的核心职责是结合车手的【专属档案背景、器材配置与历史伤病记忆】，以及系统物理引擎计算出的【权威运动学做功事实】，对本次骑行数据进行高度个性化、因人制宜的专业生理诊断与复盘。

${riderContext}

【必须完整输出以下三大核心板块（严禁漏掉任何一个板块）】：

### ⚡ 配速与骑行节奏分析
（详细对比【停表纯骑行均速】与【总均速】，评估红绿灯停顿时间对节奏的影响。结合物理引擎计算出的齿比匹配度与平路巡航做功效率，给出红绿灯起步降档防伤膝指导）

### ⛰️ 地形适应与体能消耗
（必须直接引用物理引擎计算的【重力势能做功与爬升均摊功率】，重点分析右膝半月板受力与防劳损保护情况，结合 Karvonen 生理区间评估有氧负荷）

### 💡 下阶段训练与恢复建议
（结合车手阶段目标，给出 2-3 条明确、可落地的单次训练目标：如平路高踏频专项、齿比选择与恢复注意事项）

输出要求：语言专业、客观严谨，必须完整输出上述全部 3 个板块，总字数约 350-500 字。`;

    const userPrompt = `本次骑行活动遥测数据与【物理引擎确定性计算事实】：
- 活动名称: ${ride.title}
- 骑行日期: ${new Date(ride.start_time).toLocaleString('zh-CN')}
- 实际总里程: ${distKm} 公里
- ⏱️ 纯运动时间: ${movingMins} 分钟
- ⏳ 总历时时间: ${elapsedMins} 分钟（含 ⏸️ 停顿/红绿灯 ${pausedMins} 分钟）
- ⚡ 停表纯骑行均速: ${movingAvgSpeedKmh} km/h (纯踩踏做功均速)
- 🌐 综合总均速: ${elapsedAvgSpeedKmh} km/h (门到门总耗时均速)
- 🏆 最高冲刺极速: ${ride.max_speed_kmh || 0} km/h
- ⛰️ 累计爬升高度: ${ride.total_ascent_meters || 0} 米
- 📐 【物理引擎 - 爬坡做功】: 克服重力势能做功约 ${climbResult.gravity_work_kj} kJ，爬升均摊功率约 ${climbResult.gravity_power_watts} W (${climbResult.gravity_w_per_kg} W/kg，约占 FTP ${climbResult.ftp_percentage || 16}%)，负荷评级: ${climbResult.intensity_rating}
- ⚙️ 【物理引擎 - 齿比匹配】: 巡航 ${movingAvgSpeedKmh}km/h 最优档位推荐: ${gearResult.recommended_cruising_cog?.cog ? `46/${gearResult.recommended_cruising_cog.cog}T (@ ${gearResult.recommended_cruising_cog.required_cadence_rpm} rpm)` : '46/17T 或 46/19T'}
- ❤️ 【物理引擎 - 心率区间】: Zone 2 黄金有氧区间为 ${hrResult.zones.zone2_endurance.min}-${hrResult.zones.zone2_endurance.max} bpm
- 📅 近 7 天训练负荷: 完成 ${recentCount} 次骑行，累计 ${recentDistKm} 公里。

请结合我的个人车手档案与物理计算事实，为我生成本次完整的专属三板块生理复盘。`;

    const res = await callAICompletion(config, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3, max_tokens: 3000 });

    if (!res.ok) {
      const errText = await res.text();
      return c.json({ error: `AI service error: ${errText}` }, 502);
    }

    const data: any = await res.json();
    let insight = data.choices?.[0]?.message?.content || '';

    if (!insight.includes('地形') || !insight.includes('建议') || insight.length < 300) {
      const retryRes = await callAICompletion(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt + '\n\n【重要】：请务必完整输出「⚡ 配速与骑行节奏分析」、「⛰️ 地形适应与体能消耗」、「💡 下阶段训练与恢复建议」三大完整段落！' }
      ], { temperature: 0.2, max_tokens: 3000 });

      if (retryRes.ok) {
        const retryData: any = await retryRes.json();
        const retryText = retryData.choices?.[0]?.message?.content;
        if (retryText && retryText.length > insight.length) {
          insight = retryText;
        }
      }
    }

    if (!insight) insight = '未能生成完整分析报告。';

    await c.env.DB.prepare(`
      INSERT INTO ride_insights (ride_id, content_hash, insight, created_at)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT(ride_id) DO UPDATE SET
        content_hash = excluded.content_hash,
        insight = excluded.insight,
        created_at = excluded.created_at
    `).bind(rideId, contentHash, insight).run();

    return c.json({ insight, cached: false });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { ensureTables } from '../services/dbInit';
import { getAIConfig, sha256, callAICompletion } from '../services/aiClient';
import { getRiderContextPrompt } from '../services/riderService';

export const aiInsightsRouter = new Hono<{ Bindings: Bindings }>();

// 1. 单次骑行深度生理复盘（含双均速与停顿时间剖析）
aiInsightsRouter.get('/rides/:id/insight', async (c) => {
  const rideId = c.req.param('id');
  const force = c.req.query('force') === 'true';
  try {
    await ensureTables(c.env.DB);

    const ride = await c.env.DB.prepare('SELECT * FROM rides WHERE id = ?').bind(rideId).first<any>();
    if (!ride) {
      return c.json({ error: 'Ride not found' }, 404);
    }

    const distKm = (ride.distance_meters / 1000).toFixed(2);
    const movingSec = ride.moving_time_seconds || ride.elapsed_time_seconds || 1;
    const elapsedSec = ride.elapsed_time_seconds || ride.moving_time_seconds || movingSec;
    const pausedSec = Math.max(0, elapsedSec - movingSec);

    const movingMins = (movingSec / 60).toFixed(1);
    const elapsedMins = (elapsedSec / 60).toFixed(1);
    const pausedMins = (pausedSec / 60).toFixed(1);

    const movingAvgSpeedKmh = movingSec > 0 ? Number(((ride.distance_meters / 1000) / (movingSec / 3600)).toFixed(1)) : 0;
    const elapsedAvgSpeedKmh = elapsedSec > 0 ? Number(((ride.distance_meters / 1000) / (elapsedSec / 3600)).toFixed(1)) : 0;

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
你的核心职责是结合车手的【专属档案背景、器材配置与历史伤病记忆】，对本次骑行数据进行高度个性化、因人制宜的专业生理诊断与复盘。

${riderContext}

【必须完整输出以下三大核心板块（严禁漏掉任何一个板块）】：

### ⚡ 配速与骑行节奏分析
（详细对比【停表纯骑行均速】与【总均速】，评估红绿灯停顿时间对节奏的影响。结合大行 P8 46T/11-28T 7速齿比，指出踏频匹配度与平路巡航做功效率，给出红绿灯起步降档防伤膝指导）

### ⛰️ 地形适应与体能消耗
（结合车手 75kg 体重、累计爬升高度与做功负荷，重点分析右膝半月板受力与防劳损保护情况，估算有氧区间心率负荷）

### 💡 下阶段训练与恢复建议
（结合车手阶段目标，给出 2-3 条明确、可落地的单次训练目标：如平路高踏频专项、齿比选择与恢复注意事项）

输出要求：语言专业、客观严谨，必须完整输出上述全部 3 个板块，总字数约 350-500 字。`;

    const userPrompt = `本次骑行活动数据：
- 活动名称: ${ride.title}
- 骑行日期: ${new Date(ride.start_time).toLocaleString('zh-CN')}
- 实际总里程: ${distKm} 公里
- ⏱️ 纯运动时间: ${movingMins} 分钟
- ⏳ 总历时时间: ${elapsedMins} 分钟（含 ⏸️ 停顿/红绿灯 ${pausedMins} 分钟）
- ⚡ 停表纯骑行均速: ${movingAvgSpeedKmh} km/h (纯踩踏做功均速)
- 🌐 综合总均速: ${elapsedAvgSpeedKmh} km/h (门到门总耗时均速)
- 🏆 最高冲刺极速: ${ride.max_speed_kmh || 0} km/h
- ⛰️ 累计爬升高度: ${ride.total_ascent_meters || 0} 米
- 📅 近 7 天训练负荷: 完成 ${recentCount} 次骑行，累计 ${recentDistKm} 公里。

请结合我的个人车手档案与器材配置，为我生成本次完整的专属三板块生理复盘。`;

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

// 2. 骑行活动标准标题与标签智能生成
aiInsightsRouter.post('/rides/suggest-title', async (c) => {
  try {
    const config = await getAIConfig(c.env.DB);
    const body = await c.req.json();
    const { start_time, distance_km, avg_speed_kmh, total_ascent_meters, city } = body;

    let timePeriod = '日间';
    if (start_time) {
      const hour = new Date(start_time).getHours();
      if (hour >= 5 && hour < 9) timePeriod = '晨间';
      else if (hour >= 9 && hour < 17) timePeriod = '午后';
      else if (hour >= 17 && hour < 19) timePeriod = '傍晚';
      else timePeriod = '夜间';
    }

    let intensityType = '日常巡航';
    if ((total_ascent_meters || 0) > 200) intensityType = '起伏爬坡';
    else if ((avg_speed_kmh || 0) >= 23) intensityType = '高强度节奏训';
    else if ((avg_speed_kmh || 0) >= 18) intensityType = '进阶巡航';
    else intensityType = '轻松恢复骑';

    const fallbackTitle = `${city || '城市'}${timePeriod}${intensityType} ${distance_km || 15}km`;

    const res = await callAICompletion(config, [
      {
        role: 'system',
        content: '你是一名严谨的专业自行车运动日志系统（遵循 Strava 行业标准）。根据客观骑行数据生成标准命名（格式：[城市/标志路段] + [时段] + [强度属性] + [里程]km）。直接输出标题文本，不要包含引号、Markdown 或任何解释。'
      },
      {
        role: 'user',
        content: `城市地点: ${city || '城市'}\n骑行时段: ${timePeriod}\n强度属性: ${intensityType}\n实际里程: ${distance_km || 15}km\n平均时速: ${avg_speed_kmh || 15}km/h\n累计爬升: ${total_ascent_meters || 0}m`
      }
    ], { temperature: 0.3, max_tokens: 100 });

    if (!res.ok) {
      return c.json({ title: fallbackTitle, tags: ['骑行', timePeriod] });
    }

    const data: any = await res.json();
    let title = data.choices?.[0]?.message?.content?.trim() || '';
    title = title.replace(/^["'“”]+|["'“”]+$/g, '').replace(/^标题[:：]/, '').trim();

    if (!title || title.length < 4 || title.includes('\n')) {
      title = fallbackTitle;
    }

    return c.json({ title, tags: ['骑行', timePeriod, intensityType] });
  } catch (err: any) {
    return c.json({ title: '城市户外巡航 15km', tags: ['骑行'] });
  }
});

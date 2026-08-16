import { Hono } from 'hono';
import type { Bindings } from '../types';
import { ensureTables } from '../services/dbInit';
import { getAIConfig, callAICompletion } from '../services/aiClient';
import { getRiderContextPrompt } from '../services/riderService';
import { computePeriodicSummary } from '../services/reportService';
import type { PeriodType } from '../utils/dateUtils';

export const reportsRouter = new Hono<{ Bindings: Bindings }>();

// 1. 获取周期汇总与趋势拆解数据
reportsRouter.get('/summary', async (c) => {
  try {
    await ensureTables(c.env.DB);
    const type = (c.req.query('type') || 'week') as PeriodType;
    const timestamp = Number(c.req.query('timestamp')) || Date.now();

    const result = await computePeriodicSummary(c.env.DB, type, timestamp);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 2. AI 周期复盘与表现评估报告 (含双均速与踩踏效率分析)
reportsRouter.post('/insight', async (c) => {
  try {
    await ensureTables(c.env.DB);
    const body = await c.req.json();
    const { period_type, summary, rides_count } = body;

    const config = await getAIConfig(c.env.DB);
    const riderContext = await getRiderContextPrompt(c.env.DB);

    const typeNames: Record<string, string> = {
      week: '周度',
      month: '月度',
      half_year: '半年度',
      year: '年度'
    };
    const typeLabel = typeNames[period_type] || '周期';

    const systemPrompt = `你是由世界顶级自行车职业车队运动表现总监与运动生理学专家联合调校的 **VeloTrack 专属周期训练顾问**。
你的职责是结合车手的【专属档案背景、战车配置（如大行P8折叠车46T/11-28T齿比）与历史伤病记忆】，对车手的【${typeLabel}训练数据、双均速与环比趋势】进行深入、系统性的运动生理与负荷诊断，并给出下一阶段清晰的周期性课表。

${riderContext}

【必须严格按以下三大板块输出（不可缺少任何一个板块）】：

### 📊 周期负荷与完成度评估
（深入评价本${typeLabel}的总里程 ${summary.total_distance_km}km、有效运动时间 ${(summary.moving_time_seconds / 3600).toFixed(1)}小时、停顿时间 ${(summary.paused_time_seconds / 3600).toFixed(1)}小时、总爬升 ${summary.total_ascent_meters}m、活动频次与环比增减情况，评估体能增长与耐力储备）

### 🔬 踏频节奏与体能/膝盖恢复诊断
（结合战车46T/11-28T 7速齿比、【停表纯骑行均速 ${summary.moving_avg_speed_kmh || summary.avg_speed_kmh}km/h】与【总均速 ${summary.elapsed_avg_speed_kmh || summary.avg_speed_kmh}km/h】，重点分析踩踏做功效率与右膝半月板受力防护，诊断疲劳积累情况）

### 🎯 下一周期针对性训练课表
（根据车手核心训练目标，给出下一周期的具体阶段性训练指导：包括高踏频有氧基底训练、爬坡齿比建议与恢复安排）

输出要求：语言专业、客观深刻、鼓舞人心，总字数约 400-600 字。`;

    const userPrompt = `车手本${typeLabel}骑行总结数据：
- 周期类型: ${typeLabel}总结
- 累计骑行里程: ${summary.total_distance_km} 公里 (环比上一周期变化: ${summary.distance_change_pct > 0 ? '+' : ''}${summary.distance_change_pct}%)
- ⏱️ 累计运动时间: ${(summary.moving_time_seconds / 3600).toFixed(1)} 小时 (门到门总历时: ${(summary.elapsed_time_seconds / 3600).toFixed(1)} 小时，累计停顿: ${(summary.paused_time_seconds / 3600).toFixed(1)} 小时，有效踩踏占比: ${summary.moving_ratio_pct}%)
- ⚡ 周期加权【停表纯骑行均速】: ${summary.moving_avg_speed_kmh || summary.avg_speed_kmh} km/h (纯踩踏效率)
- 🌐 周期综合【总均速】: ${summary.elapsed_avg_speed_kmh || summary.avg_speed_kmh} km/h
- 累计爬升做功: ${summary.total_ascent_meters} 米 (环比: ${summary.ascent_change_pct > 0 ? '+' : ''}${summary.ascent_change_pct}%)
- 最高瞬时冲刺: ${summary.max_speed_kmh} km/h
- 消耗能量估计: ${summary.calories} kcal
- 完成骑行活动: ${rides_count} 次，活跃天数: ${summary.active_days_count} 天

请结合我的个人生理档案与既往记忆，为我生成一份权威、个性化的${typeLabel}运动表现复盘报告与下阶段课表。`;

    const res = await callAICompletion(config, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { temperature: 0.3, max_tokens: 3000 });

    if (!res.ok) {
      const errText = await res.text();
      return c.json({ error: `AI service error: ${errText}` }, 502);
    }

    const data: any = await res.json();
    const insight = data.choices?.[0]?.message?.content || '未能生成周期分析报告。';

    return c.json({ insight });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

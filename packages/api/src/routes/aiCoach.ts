import { Hono } from 'hono';
import type { Bindings } from '../types';
import { ensureTables } from '../services/dbInit';
import { getAIConfig, callAICompletion } from '../services/aiClient';
import { 
  updateRiderProfile, 
  updateTrainingGoals,
  addGoalMilestone,
  upsertRiderMemory, 
  getRiderContextPrompt 
} from '../services/riderService';
import {
  calculateGearCadenceSpeed,
  calculateClimbingPower,
  calculateHeartRateZones,
  calculateGoalTimeline
} from '../utils/cyclingPhysicsEngine';

export const aiCoachRouter = new Hono<{ Bindings: Bindings }>();

// 1. 获取会话列表
aiCoachRouter.get('/coach/sessions', async (c) => {
  try {
    await ensureTables(c.env.DB);
    const sessions = await c.env.DB.prepare(`
      SELECT 
        session_id, 
        MAX(created_at) as last_activity,
        COUNT(*) as message_count,
        (SELECT content FROM ai_messages WHERE session_id = m.session_id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as first_question
      FROM ai_messages m
      GROUP BY session_id
      ORDER BY last_activity DESC
      LIMIT 30
    `).all<any>();

    return c.json({ sessions: sessions.results || [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 2. 获取单个会话历史消息 (包含 tool_calls 状态)
aiCoachRouter.get('/coach/:session/messages', async (c) => {
  const sessionId = c.req.param('session');
  try {
    await ensureTables(c.env.DB);
    const rows = await c.env.DB.prepare(`
      SELECT id, role, content, tool_calls, created_at
      FROM ai_messages
      WHERE session_id = ? AND role IN ('user', 'assistant') AND content IS NOT NULL AND content != ''
      ORDER BY created_at ASC
    `).bind(sessionId).all<any>();

    return c.json({ messages: rows.results || [] });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 3. 删除指定会话
aiCoachRouter.delete('/coach/:session', async (c) => {
  const sessionId = c.req.param('session');
  try {
    await ensureTables(c.env.DB);
    await c.env.DB.prepare('DELETE FROM ai_messages WHERE session_id = ?').bind(sessionId).run();
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 4. 多轮对话与 Tool Calling 执教引擎 (集成确定性运动物理计算引擎)
aiCoachRouter.post('/coach/:session/chat', async (c) => {
  const sessionId = c.req.param('session');
  try {
    await ensureTables(c.env.DB);
    const { message } = await c.req.json();
    if (!message) return c.json({ error: 'Message is required' }, 400);

    const config = await getAIConfig(c.env.DB, c.env);
    const riderContext = await getRiderContextPrompt(c.env.DB);

    // 取"最近"30 条消息：先按时间倒序取最新，再反转为正序。
    // 修复：原 ORDER BY ASC LIMIT 30 取的是最早 30 条，长会话中模型永远看不到近期上下文
    const historyRows = await c.env.DB.prepare(`
      SELECT role, content, tool_calls, tool_call_id, name
      FROM ai_messages
      WHERE session_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT 30
    `).bind(sessionId).all<any>();
    (historyRows.results || []).reverse();

    const eliteCoachSystemPrompt = `你是由世界顶级自行车职业车队运动表现总监、运动生物力学专家联合调校的 **VeloTrack 专属私人骑行教练**。

${riderContext}

【教练核心执教职责与【确定性物理计算与主动评估】铁律】：
1. **严禁心算运动学与物理数据，必须调用计算工具**：
   - 当涉及**齿比与时速踏频换算**（如 46T 牙盘配 17T/19T 飞轮在 90rpm 的时速、或 20km/h 巡航所需踏频）、**爬坡克服重力功率做功 (W/kg 与 %FTP)**、**Karvonen 生理心率 5 区计算** 或 **目标达成剩余周数推演**时，**严禁口算猜测！必须优先调用工具 calculate_cycling_kinematics 获取 100% 确定性的数学物理计算结果**，并在分析中精准引用！
2. **科学运用【双均速】与【运动/停顿时间】进行专业剖析**：
   - ⚡ **停表均速 (Moving Avg Speed)**：基于纯踩踏运动做功时间计算，是评估车手真实巡航体能、输出功率与踏频匹配度的**首要核心基准**（不受城市红绿灯与路口停顿拉低）；
   - 🌐 **总均速 (Elapsed Avg Speed)**：基于门到门总历时计算，反映路线通畅度、红绿灯密集度与长途拉练节奏；
   - ⏸️ **停顿时间 (Paused Time)**：当发现车手总均速明显低于停表均速（如停顿 20~30 分钟），说明红绿灯走走停停较多。**必须重点提醒车手：红绿灯起步前务必提前降档至中轻齿比，绿灯亮起以轻快高踏频平顺起步，严禁用大齿比死蹬重踏，以防膝盖半月板急性劳损！**
3. **主动洞察车手当前状态与自主设定目标**：
   - 审视【车手真实数据库近期实战状态】与【系统当前量化目标】。当车手近期周完成度高（80%+、单次突破、无伤病），主动提出调高目标，并**在当前轮次主动调用 set_training_goals 写入系统生效**。
4. **器材与硬件独立局部更新原则**：
   - 当车手提及改装、更换齿比（如 46T牙盘+11-28T 7速）、更换外胎、脚踏或战车时，**必须调用 update_rider_profile 工具进行局部合并更新，绝不能抹去已有的外胎或配件数据**！
5. **数据查库优先**：当分析历史表现、对比或做计划时，**优先调用工具 query_rides_summary 获取真实数据**。
6. **结构化专业输出**：
   - 📊 **车手近期状态主动洞察（含停表均速与有效运动时间分析）**
   - ⚙️ **精准物理运动学计算与齿比/功率解析（基于精确计算工具结果）**
   - 🎯 **量化目标与专属 4 周执行指南（含红绿灯起步控频与膝盖保护）**`;

    const messages: any[] = [
      { role: 'system', content: eliteCoachSystemPrompt }
    ];

    (historyRows.results || []).forEach((row) => {
      if (row.role === 'tool') {
        messages.push({
          role: 'tool',
          tool_call_id: row.tool_call_id,
          content: row.content
        });
      } else if (row.role === 'assistant' && row.tool_calls) {
        messages.push({
          role: 'assistant',
          content: row.content || '',
          tool_calls: JSON.parse(row.tool_calls)
        });
      } else {
        messages.push({
          role: row.role,
          content: row.content
        });
      }
    });

    messages.push({ role: 'user', content: message });
    await c.env.DB.prepare(`
      INSERT INTO ai_messages (session_id, role, content, created_at)
      VALUES (?, 'user', ?, unixepoch())
    `).bind(sessionId, message).run();

    const tools = [
      {
        type: 'function',
        function: {
          name: 'calculate_cycling_kinematics',
          description: '【运动学与物理确定性计算引擎】计算齿比时速踏频对照表、爬坡克服重力做功与功率瓦特(W/kg)、Karvonen心率5区阈值、目标达成剩余周数时间预算',
          parameters: {
            type: 'object',
            properties: {
              operation: {
                type: 'string',
                enum: ['gear_cadence_speed', 'climbing_power', 'hr_zones', 'goal_timeline'],
                description: '计算类型：gear_cadence_speed(齿比踏频时速换算), climbing_power(爬升做功与克服重力功率), hr_zones(心率储备5区), goal_timeline(目标达成时间推演)'
              },
              // For gear_cadence_speed
              chainring: { type: 'number', description: '前牙盘齿数，例如 46 或 53' },
              cogs: { type: 'array', items: { type: 'number' }, description: '后飞轮齿数列表，如 [11, 13, 15, 17, 19, 21, 24, 28]' },
              wheel_spec: { type: 'string', description: '轮径规格，如 "20x2.0" (大行P8/406), "20x1-1/8" (451), "700x25c"' },
              cadence_rpm: { type: 'number', description: '给定踩踏踏频(rpm)，计算各档位时速' },
              target_speed_kmh: { type: 'number', description: '给定目标巡航时速(km/h)，计算各档位所需踏频并找出85-95rpm黄金档位' },
              // For climbing_power
              rider_weight_kg: { type: 'number', description: '车手体重(kg)' },
              bike_weight_kg: { type: 'number', description: '战车整备重量(kg)' },
              ascent_meters: { type: 'number', description: '累计爬升高度(米)' },
              moving_time_seconds: { type: 'number', description: '纯运动耗时(秒)' },
              ftp_watts: { type: 'number', description: '车手功能阈值功率(FTP)' },
              // For hr_zones
              max_hr: { type: 'number', description: '最大心率(bpm)' },
              resting_hr: { type: 'number', description: '静息心率(bpm)' },
              current_hr: { type: 'number', description: '当前骑行平均心率(bpm)' },
              // For goal_timeline
              current_total_km: { type: 'number', description: '当前已完成累计里程(km)' },
              target_total_km: { type: 'number', description: '总目标里程(km)' },
              weekly_target_km: { type: 'number', description: '每周目标骑行里程(km)' },
              sessions_per_week: { type: 'number', description: '每周计划骑行频次，默认3' }
            },
            required: ['operation']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'query_rides_summary',
          description: '查询全部或指定城市的骑行统计摘要（总里程、停表均速、总均速、运动时间、停顿时间、活动列表）',
          parameters: {
            type: 'object',
            properties: {
              city: { type: 'string', description: '城市名（例如 "广州"、"深圳" 或 "全部"）' }
            },
            required: ['city']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'set_training_goals',
          description: '当教练根据车手状态主动调整或制定量化训练目标时调用此工具自动同步到系统',
          parameters: {
            type: 'object',
            properties: {
              primary_goal: { type: 'string', description: '阶段训练核心主目标（如：进阶50km长距离耐力，提升平路巡航停表均速至20km/h）' },
              weekly_distance_km: { type: 'number', description: '每周目标骑行里程(km)' },
              target_avg_speed_kmh: { type: 'number', description: '目标平路巡航停表均速(km/h)' },
              monthly_distance_km: { type: 'number', description: '单月目标里程(km)' },
              coach_notes: { type: 'string', description: '教练给出的专属训练与踏频/齿比/膝盖保护指导说明' }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'update_rider_profile',
          description: '当车手透露了体重、身高、车型、齿比、外胎、车重、改装件、伤病或目标时自动更新档案',
          parameters: {
            type: 'object',
            properties: {
              weight_kg: { type: 'number', description: '车手体重(kg)' },
              height_cm: { type: 'number', description: '车手身高(cm)' },
              current_bike: { type: 'string', description: '主力战车型号' },
              gear_ratio: { type: 'string', description: '齿比与变速配置，如"46T牙盘 + 11-28T 7速飞轮"' },
              tires: { type: 'string', description: '外胎规格与胎压，如"马牌 Contact Urban 2.0 轮胎 (75-80 psi)"' },
              bike_weight_kg: { type: 'number', description: '战车净重(kg)' },
              custom_specs: { type: 'object', description: '任意其他自定义硬件/配件/生理属性键值对' },
              injuries_notes: { type: 'string', description: '既往旧伤或身体不适备忘' },
              primary_goal: { type: 'string', description: '阶段训练目标' }
            }
          }
        }
      }
    ];

    let goalUpdatedData: any = null;
    let profileUpdatedData: any = null;
    let executedToolCalls: any[] = [];

    async function executeTool(name: string, args: any) {
      if (name === 'calculate_cycling_kinematics') {
        const op = args.operation;
        if (op === 'gear_cadence_speed') {
          return calculateGearCadenceSpeed({
            chainring: args.chainring || 46,
            cogs: args.cogs || [11, 13, 15, 17, 19, 21, 24, 28],
            wheelSpec: args.wheel_spec || '20x2.0',
            cadenceRpm: args.cadence_rpm,
            targetSpeedKmh: args.target_speed_kmh
          });
        } else if (op === 'climbing_power') {
          return calculateClimbingPower({
            riderWeightKg: args.rider_weight_kg || 75,
            bikeWeightKg: args.bike_weight_kg || 11.5,
            ascentMeters: args.ascent_meters || 0,
            movingTimeSeconds: args.moving_time_seconds || 3600,
            ftpWatts: args.ftp_watts || 165
          });
        } else if (op === 'hr_zones') {
          return calculateHeartRateZones({
            maxHr: args.max_hr || 188,
            restingHr: args.resting_hr || 55,
            currentAvgHr: args.current_hr
          });
        } else if (op === 'goal_timeline') {
          return calculateGoalTimeline({
            currentTotalKm: args.current_total_km || 0,
            targetTotalKm: args.target_total_km || 1000,
            weeklyTargetKm: args.weekly_target_km || 60,
            sessionsPerWeek: args.sessions_per_week || 3,
            targetAvgSpeedKmh: args.target_speed_kmh || 18
          });
        }
        return { error: `Unsupported calculation operation: ${op}` };
      } else if (name === 'query_rides_summary') {
        const city = args.city || '全部';
        const allRides = await c.env.DB.prepare('SELECT * FROM rides ORDER BY start_time DESC').all<any>();
        const filtered = (allRides.results || []).filter((r: any) => {
          if (city === '全部') return true;
          const rCity = (r.start_lat || 0) > 22.8 ? '广州' : '深圳';
          return rCity.includes(city);
        });

        const totalDistMeters = filtered.reduce((acc, r) => acc + (r.distance_meters || 0), 0);
        const totalDistKm = Number((totalDistMeters / 1000).toFixed(1));
        const totalAscentM = filtered.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0);

        const totalMovingSec = filtered.reduce((acc, r) => acc + (r.moving_time_seconds || r.elapsed_time_seconds || 0), 0);
        const totalElapsedSec = filtered.reduce((acc, r) => acc + (r.elapsed_time_seconds || r.moving_time_seconds || 0), 0);
        const totalPausedSec = Math.max(0, totalElapsedSec - totalMovingSec);

        const overallMovingAvgSpeed = totalMovingSec > 0 ? Number(((totalDistMeters / 1000) / (totalMovingSec / 3600)).toFixed(1)) : 0;
        const overallElapsedAvgSpeed = totalElapsedSec > 0 ? Number(((totalDistMeters / 1000) / (totalElapsedSec / 3600)).toFixed(1)) : 0;

        return {
          city_queried: city,
          ride_count: filtered.length,
          total_distance_km: totalDistKm,
          moving_avg_speed_kmh: overallMovingAvgSpeed,
          elapsed_avg_speed_kmh: overallElapsedAvgSpeed,
          total_moving_time_hours: Number((totalMovingSec / 3600).toFixed(1)),
          total_paused_time_hours: Number((totalPausedSec / 3600).toFixed(1)),
          moving_ratio_pct: totalElapsedSec > 0 ? Math.round((totalMovingSec / totalElapsedSec) * 100) : 100,
          total_ascent_meters: totalAscentM,
          recent_rides: filtered.slice(0, 5).map(r => {
            const mSec = r.moving_time_seconds || r.elapsed_time_seconds || 0;
            const eSec = r.elapsed_time_seconds || r.moving_time_seconds || 0;
            const dKm = (r.distance_meters || 0) / 1000;
            return {
              title: r.title,
              date: new Date(r.start_time).toISOString().split('T')[0],
              distance_km: Number(dKm.toFixed(1)),
              moving_time_mins: Math.round(mSec / 60),
              paused_time_mins: Math.max(0, Math.round((eSec - mSec) / 60)),
              moving_avg_speed_kmh: mSec > 0 ? Number((dKm / (mSec / 3600)).toFixed(1)) : 0,
              elapsed_avg_speed_kmh: eSec > 0 ? Number((dKm / (eSec / 3600)).toFixed(1)) : 0,
              ascent_m: r.total_ascent_meters
            };
          })
        };
      } else if (name === 'set_training_goals') {
        const updatedGoals = await updateTrainingGoals(c.env.DB, {
          weekly_distance_km: args.weekly_distance_km,
          target_avg_speed_kmh: args.target_avg_speed_kmh,
          monthly_distance_km: args.monthly_distance_km,
          coach_notes: args.coach_notes
        });

        if (args.primary_goal) {
          await updateRiderProfile(c.env.DB, { primary_goal: args.primary_goal });
        }

        // Record episodic milestone evolution (L3 Episodic Memory)
        await addGoalMilestone(c.env.DB, {
          weekly_distance_km: args.weekly_distance_km || 60,
          target_avg_speed_kmh: args.target_avg_speed_kmh || 18,
          monthly_distance_km: args.monthly_distance_km,
          primary_goal: args.primary_goal,
          rationale: args.coach_notes ? args.coach_notes.slice(0, 60) : '教练根据近期巡航表现主动调优目标',
          source: 'coach'
        });

        goalUpdatedData = {
          primary_goal: args.primary_goal,
          weekly_distance_km: args.weekly_distance_km,
          target_avg_speed_kmh: args.target_avg_speed_kmh,
          monthly_distance_km: args.monthly_distance_km,
          coach_notes: args.coach_notes
        };

        return {
          success: true,
          message: '训练目标已在系统成功设定生效，并记录阶段里程碑演进轨迹',
          current_goals: updatedGoals
        };
      } else if (name === 'update_rider_profile') {
        const updatedProfile = await updateRiderProfile(c.env.DB, args);
        profileUpdatedData = { ...args };
        return {
          success: true,
          message: '车手档案与硬件配置已成功更新并保留既有配置',
          profile: updatedProfile
        };
      }
      return { error: 'Unknown tool' };
    }

    let loopCount = 0;
    let finalReply = '';

    while (loopCount < 6) {
      loopCount++;

      const res = await callAICompletion(config, messages, { tools, tool_choice: 'auto', temperature: 0.3, max_tokens: 4096 });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        finalReply = `分析服务响应异常 (HTTP ${res.status}): ${errText || '请确认服务端点与网络连接。'}`;
        break;
      }

      const data: any = await res.json();
      const choice = data.choices?.[0];
      if (!choice) {
        finalReply = '未能生成分析。';
        break;
      }

      const msg = choice.message;
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        executedToolCalls = [...executedToolCalls, ...msg.tool_calls];
        messages.push({
          role: 'assistant',
          content: msg.content || '',
          tool_calls: msg.tool_calls
        });

        await c.env.DB.prepare(`
          INSERT INTO ai_messages (session_id, role, content, tool_calls, created_at)
          VALUES (?, 'assistant', ?, ?, unixepoch())
        `).bind(sessionId, msg.content || '', JSON.stringify(msg.tool_calls)).run();

        for (const tc of msg.tool_calls) {
          const fnName = tc.function.name;
          const fnArgs = JSON.parse(tc.function.arguments || '{}');
          const result = await executeTool(fnName, fnArgs);

          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result)
          });

          await c.env.DB.prepare(`
            INSERT INTO ai_messages (session_id, role, content, tool_call_id, name, created_at)
            VALUES (?, 'tool', ?, ?, ?, unixepoch())
          `).bind(sessionId, JSON.stringify(result), tc.id, fnName).run();
        }
      } else {
        finalReply = msg.content || msg.reasoning_content || '';
        if (finalReply) {
          const toolCallsJson = executedToolCalls.length > 0 ? JSON.stringify(executedToolCalls) : null;
          await c.env.DB.prepare(`
            INSERT INTO ai_messages (session_id, role, content, tool_calls, created_at)
            VALUES (?, 'assistant', ?, ?, unixepoch())
          `).bind(sessionId, finalReply, toolCallsJson).run();
        }
        break;
      }
    }

    if (!finalReply.trim()) {
      const fallbackRes = await callAICompletion(config, [
        { role: 'system', content: eliteCoachSystemPrompt },
        { role: 'user', content: message }
      ], { temperature: 0.4, max_tokens: 4096 });

      if (fallbackRes.ok) {
        const fbData: any = await fallbackRes.json();
        finalReply = fbData.choices?.[0]?.message?.content || '教练正在整理分析报告，请稍后再试。';
        await c.env.DB.prepare(`
          INSERT INTO ai_messages (session_id, role, content, created_at)
          VALUES (?, 'assistant', ?, unixepoch())
        `).bind(sessionId, finalReply).run();
      }
    }

    // 智能记忆反思与原子事实提炼引擎 (L2 Semantic Memory Reflection Engine)
    if (message.length > 6 && (
      message.includes('换了') || message.includes('买了') || message.includes('改装') ||
      message.includes('膝盖') || message.includes('痛') || message.includes('酸') || message.includes('伤') ||
      message.includes('习惯') || message.includes('喜欢') || message.includes('偏好') ||
      message.includes('齿比') || message.includes('胎压') || message.includes('脚踏') || message.includes('坐垫')
    )) {
      try {
        const reflectionPrompt = `你是一个严谨的运动档案语义事实提炼专家（遵循 Agentic Memory 规范）。
从车手（用户）最新发言中，提炼出【车手自身】的 1 条持久原子事实。
严禁提取教练说的话、训练课表或长篇大论！每条事实必须是 ≤35 字的精炼陈述。

分类类别：
- health: 身体伤病、膝盖感受或健康底线
- gear: 战车零件改装、齿比习惯、外胎胎压或配件微调
- habit: 骑行时段习惯、路线偏好或作息
- preference: 训练风格喜好或心理态度

必须输出 JSON 格式（无新事实则输出 {}）：
{"category": "health|gear|habit|preference", "memory_key": "unique_snake_case_key", "content": "精炼陈述", "importance": 1-5}`;

        const extractRes = await callAICompletion(config, [
          { role: 'system', content: reflectionPrompt },
          { role: 'user', content: message }
        ], { temperature: 0.1, max_tokens: 150 });

        if (extractRes.ok) {
          const extData: any = await extractRes.json();
          const extText = extData.choices?.[0]?.message?.content || '{}';
          const match = extText.match(/\{[\s\S]*\}/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (parsed.content && parsed.category && parsed.memory_key && parsed.content.length <= 60) {
              await upsertRiderMemory(
                c.env.DB,
                parsed.category,
                parsed.memory_key,
                parsed.content,
                'coach',
                parsed.importance || 3
              );
            }
          }
        }
      } catch (err) {
        console.error('Memory reflection error:', err);
      }
    }

    return c.json({ 
      reply: finalReply, 
      goalUpdated: goalUpdatedData,
      profileUpdated: profileUpdatedData,
      toolCalls: executedToolCalls
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

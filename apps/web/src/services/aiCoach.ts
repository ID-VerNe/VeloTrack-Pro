/**
 * VeloTrack 前端 aiCoach 服务
 *
 * 从 packages/api/src/routes/aiCoach.ts 平移（512 行 tool-calling 循环 + 记忆反思）。
 * 多轮对话执教引擎：调 AI → 解析 tool_calls → 本地执行工具 → 回灌 → 再调 AI，
 * 最多 6 轮。工具执行结果与消息历史经后端 /api/ai/coach/:session/messages 落库。
 */

import { getAIConfig, callAICompletion, parseAIResponse } from './aiClient';
import { getRiderContextPrompt, updateRiderProfile, updateTrainingGoals, addGoalMilestone, upsertRiderMemory } from './riderService';
import {
  calculateGearCadenceSpeed,
  calculateClimbingPower,
  calculateHeartRateZones,
  calculateGoalTimeline,
} from '../utils/cyclingPhysicsEngine';
import { analyzeSpeedDistribution } from '../utils/speedDistribution';
import { getAdminToken } from '../utils/activity/adminApiClient';

const MAX_TOOL_LOOPS = 6;

// ---------------------------------------------------------------------------
// 会话与消息持久化（后端 ai_messages 表）
// ---------------------------------------------------------------------------

export interface CoachSession {
  session_id: string;
  last_activity: number;
  message_count: number;
  first_question?: string;
}

export async function getCoachSessions(): Promise<CoachSession[]> {
  const res = await fetch('/api/ai/coach/sessions');
  if (!res.ok) return [];
  const data = await res.json();
  return data.sessions || [];
}

export interface CoachMessage {
  id?: number;
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
  created_at?: number;
}

export async function getCoachMessages(sessionId: string): Promise<CoachMessage[]> {
  const res = await fetch(`/api/ai/coach/${sessionId}/messages`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages || [];
}

async function appendMessage(sessionId: string, msg: CoachMessage): Promise<void> {
  await fetch(`/api/ai/coach/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
}

export async function deleteCoachSession(sessionId: string): Promise<void> {
  const token = getAdminToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Admin-Token'] = token;
  }
  const res = await fetch(`/api/ai/coach/${sessionId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error(data.error || '鉴权未通过：管理令牌无效或已过期，请检查管理令牌（ADMIN_TOKEN）');
    }
    throw new Error(data.error || `删除会话失败 (${res.status})`);
  }
}

// ---------------------------------------------------------------------------
// 工具定义（与后端 aiCoach.ts 完全一致，供 AI 调用）
// ---------------------------------------------------------------------------

const COACH_TOOLS = [
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
            description: '计算类型：gear_cadence_speed(齿比踏频时速换算), climbing_power(爬升做功与克服重力功率), hr_zones(心率储备5区), goal_timeline(目标达成时间推演)',
          },
          chainring: { type: 'number', description: '前牙盘齿数，例如 46 或 53' },
          cogs: { type: 'array', items: { type: 'number' }, description: '后飞轮齿数列表，如 [11, 13, 15, 17, 19, 21, 24, 28]' },
          wheel_spec: { type: 'string', description: '轮径规格，如 "20x2.0" (大行P8/406), "20x1-1/8" (451), "700x25c"' },
          cadence_rpm: { type: 'number', description: '给定踩踏踏频(rpm)，计算各档位时速' },
          target_speed_kmh: { type: 'number', description: '给定目标稳态平路巡航时速(km/h)（必须使用开阔平路稳态巡航时速如 25-27km/h，严禁传入包含起步路口拉低后的停表均速），计算各档位所需踏频并找出85-95rpm黄金档位' },
          rider_weight_kg: { type: 'number', description: '车手体重(kg)' },
          bike_weight_kg: { type: 'number', description: '战车整备重量(kg)' },
          ascent_meters: { type: 'number', description: '累计爬升高度(米)' },
          moving_time_seconds: { type: 'number', description: '纯运动耗时(秒)' },
          ftp_watts: { type: 'number', description: '车手功能阈值功率(FTP)' },
          max_hr: { type: 'number', description: '最大心率(bpm)' },
          resting_hr: { type: 'number', description: '静息心率(bpm)' },
          current_hr: { type: 'number', description: '当前骑行平均心率(bpm)' },
          current_total_km: { type: 'number', description: '当前已完成累计里程(km)' },
          target_total_km: { type: 'number', description: '总目标里程(km)' },
          weekly_target_km: { type: 'number', description: '每周目标骑行里程(km)' },
          sessions_per_week: { type: 'number', description: '每周计划骑行频次，默认3' },
        },
        required: ['operation'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_rides_summary',
      description: '查询全部或指定城市的骑行统计摘要（总里程、综合停表均速、稳态巡航时速、速度损耗落差、总均速、运动时间、停顿时间、活动列表）',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名（例如 "广州"、"深圳" 或 "全部"）' },
        },
        required: ['city'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_training_goals',
      description: '当教练根据车手状态主动调整或制定量化训练目标时调用此工具自动同步到系统',
      parameters: {
        type: 'object',
        properties: {
          primary_goal: { type: 'string', description: '阶段训练核心主目标' },
          weekly_distance_km: { type: 'number', description: '每周目标骑行里程(km)' },
          target_avg_speed_kmh: { type: 'number', description: '目标平路巡航停表均速(km/h)' },
          monthly_distance_km: { type: 'number', description: '单月目标里程(km)' },
          coach_notes: { type: 'string', description: '教练给出的专属训练与踏频/齿比/膝盖保护指导说明' },
        },
      },
    },
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
          gear_ratio: { type: 'string', description: '齿比与变速配置' },
          tires: { type: 'string', description: '外胎规格与胎压' },
          bike_weight_kg: { type: 'number', description: '战车净重(kg)' },
          custom_specs: { type: 'object', description: '任意其他自定义硬件/配件/生理属性键值对' },
          injuries_notes: { type: 'string', description: '既往旧伤或身体不适备忘' },
          primary_goal: { type: 'string', description: '阶段训练目标' },
        },
      },
    },
  },
];

/**
 * 本地执行 AI 发起的工具调用。与后端 aiCoach.ts 的 executeTool 对齐。
 */
async function executeTool(name: string, args: any): Promise<any> {
  if (name === 'calculate_cycling_kinematics') {
    const op = args.operation;
    if (op === 'gear_cadence_speed') {
      return calculateGearCadenceSpeed({
        chainring: args.chainring || 46,
        cogs: args.cogs || [11, 13, 15, 17, 19, 21, 24, 28],
        wheelSpec: args.wheel_spec || '20x2.0',
        cadenceRpm: args.cadence_rpm,
        targetSpeedKmh: args.target_speed_kmh,
      });
    } else if (op === 'climbing_power') {
      return calculateClimbingPower({
        riderWeightKg: args.rider_weight_kg || 75,
        bikeWeightKg: args.bike_weight_kg || 11.5,
        ascentMeters: args.ascent_meters || 0,
        movingTimeSeconds: args.moving_time_seconds || 3600,
        ftpWatts: args.ftp_watts || 165,
      });
    } else if (op === 'hr_zones') {
      return calculateHeartRateZones({
        maxHr: args.max_hr || 188,
        restingHr: args.resting_hr || 55,
        currentAvgHr: args.current_hr,
      });
    } else if (op === 'goal_timeline') {
      return calculateGoalTimeline({
        currentTotalKm: args.current_total_km || 0,
        targetTotalKm: args.target_total_km || 1000,
        weeklyTargetKm: args.weekly_target_km || 60,
        sessionsPerWeek: args.sessions_per_week || 3,
        targetAvgSpeedKmh: args.target_speed_kmh || 18,
      });
    }
    return { error: `Unsupported calculation operation: ${op}` };
  } else if (name === 'query_rides_summary') {
    const city = args.city || '全部';
    const allRes = await fetch('/api/rides');
    const allRides: any[] = allRes.ok ? (await allRes.json()).rides || [] : [];
    const filtered = allRides.filter((r: any) => {
      if (city === '全部') return true;
      const rCity = (r.start_lat || 0) > 22.8 ? '广州' : '深圳';
      return rCity.includes(city);
    });

    const totalDistMeters = filtered.reduce((acc: number, r: any) => acc + (r.distance_meters || 0), 0);
    const totalDistKm = Number((totalDistMeters / 1000).toFixed(1));
    const totalAscentM = filtered.reduce((acc: number, r: any) => acc + (r.total_ascent_meters || 0), 0);
    const totalMovingSec = filtered.reduce((acc: number, r: any) => acc + (r.moving_time_seconds || r.elapsed_time_seconds || 0), 0);
    const totalElapsedSec = filtered.reduce((acc: number, r: any) => acc + (r.elapsed_time_seconds || r.moving_time_seconds || 0), 0);
    const totalPausedSec = Math.max(0, totalElapsedSec - totalMovingSec);
    const overallMovingAvgSpeed = totalMovingSec > 0 ? Number(((totalDistMeters / 1000) / (totalMovingSec / 3600)).toFixed(1)) : 0;
    const overallElapsedAvgSpeed = totalElapsedSec > 0 ? Number(((totalDistMeters / 1000) / (totalElapsedSec / 3600)).toFixed(1)) : 0;
    const speedDist = analyzeSpeedDistribution(null, overallMovingAvgSpeed, 46, 15);

    return {
      city_queried: city,
      ride_count: filtered.length,
      total_distance_km: totalDistKm,
      moving_avg_speed_kmh: overallMovingAvgSpeed,
      cruising_avg_speed_kmh: speedDist.cruising_avg_speed_kmh,
      speed_loss_kmh: speedDist.speed_loss_kmh,
      elapsed_avg_speed_kmh: overallElapsedAvgSpeed,
      total_moving_time_hours: Number((totalMovingSec / 3600).toFixed(1)),
      total_paused_time_hours: Number((totalPausedSec / 3600).toFixed(1)),
      moving_ratio_pct: totalElapsedSec > 0 ? Math.round((totalMovingSec / totalElapsedSec) * 100) : 100,
      total_ascent_meters: totalAscentM,
      recent_rides: filtered.slice(0, 5).map((r: any) => {
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
          ascent_m: r.total_ascent_meters,
        };
      }),
    };
  } else if (name === 'set_training_goals') {
    const updatedGoals = await updateTrainingGoals({
      weekly_distance_km: args.weekly_distance_km,
      target_avg_speed_kmh: args.target_avg_speed_kmh,
      monthly_distance_km: args.monthly_distance_km,
      coach_notes: args.coach_notes,
    });
    if (args.primary_goal) {
      await updateRiderProfile({ primary_goal: args.primary_goal });
    }
    // 记录阶段里程碑演进
    await addGoalMilestone({
      weekly_distance_km: args.weekly_distance_km || 60,
      target_avg_speed_kmh: args.target_avg_speed_kmh || 18,
      monthly_distance_km: args.monthly_distance_km,
      primary_goal: args.primary_goal,
      rationale: args.coach_notes ? args.coach_notes.slice(0, 60) : '教练根据近期巡航表现主动调优目标',
      source: 'coach',
    });
    return {
      success: true,
      message: '训练目标已在系统成功设定生效，并记录阶段里程碑演进轨迹',
      current_goals: updatedGoals,
    };
  } else if (name === 'update_rider_profile') {
    const updatedProfile = await updateRiderProfile(args);
    return {
      success: true,
      message: '车手档案与硬件配置已成功更新并保留既有配置',
      profile: updatedProfile,
    };
  }
  return { error: 'Unknown tool' };
}

// ---------------------------------------------------------------------------
// 主对话循环
// ---------------------------------------------------------------------------

export interface CoachReplyResult {
  reply: string;
  goalUpdated: any;
  profileUpdated: any;
  toolCalls: any[];
}

const COACH_SYSTEM_PROMPT = (riderContext: string) => `你是由世界顶级自行车职业车队运动表现总监、运动生物力学专家联合调校的 **VeloTrack 专属私人骑行教练**。

${riderContext}

【教练核心执教职责与【确定性物理计算与主动评估】铁律】：
1. **严禁心算运动学与物理数据，必须调用计算工具**：
   - 当涉及**齿比与时速踏频换算**、**爬坡克服重力功率做功 (W/kg 与 %FTP)**、**Karvonen 生理心率 5 区计算** 或 **目标达成剩余周数推演**时，**严禁口算猜测！必须优先调用工具 calculate_cycling_kinematics 获取 100% 确定性的数学物理计算结果**，并在分析中精准引用！
2. **科学解耦【稳态巡航时速】与【综合停表均速】，严禁混淆计算踏频**：
   - ⚡ **稳态平路巡航时速 (Cruising Speed, 约 25-27 km/h)**：这是车手在开阔平路平稳巡航时的真实动力学表现。**在评估齿比匹配度、踩踏踏频 (rpm) 与膝盖受力时，必须以此为唯一基准！**（以大行 P8 46/15T 为例，在 25.5 km/h 稳态巡航时踏频为 90 rpm，完全处于 85-95 rpm 黄金高效有氧区间，齿比选择非常科学健康，绝非重档死蹬）；
   - ⏱️ **综合停表均速 (Moving Avg Speed, 约 17-18 km/h)**：包含了大量市区红绿灯起步、低速转弯与减速阶段，拉低了整体均值。它与巡航时速的差值即为【速度落差损耗 (Speed Loss, 约 6-8 km/h)】。它用于评估城市骑行路况通畅度与起步效率，**严禁将停表均速错误套入 46/15T 误推为 63 rpm 重档死蹬**！
   - 🚦 **低速起步与红绿灯损耗指导**：损耗主要来自起步与频繁减速。**重点指导车手：红绿灯停车前提前降档至中轻齿比（如 46/19T 或 46/21T），起步时以轻快高踏频平顺提速，进入开阔平路巡航后再推至 46/15T 锁住 90 rpm 巡航，兼顾膝盖保护与巡航效率！**
   - 🌐 **总均速 (Elapsed Avg Speed)** 与 ⏸️ **停顿时间 (Paused Time)**：反映门到门总耗时与红绿灯等待时长。
3. **主动洞察车手当前状态与自主设定目标**：
   - 审视【车手真实数据库近期实战状态】与【系统当前量化目标】。当车手近期周完成度高（80%+、单次突破、无伤病），主动提出调高目标，并**在当前轮次主动调用 set_training_goals 写入系统生效**。
4. **器材与硬件独立局部更新原则**：
   - 当车手提及改装、更换齿比、更换外胎、脚踏或战车时，**必须调用 update_rider_profile 工具进行局部合并更新，绝不能抹去已有的外胎或配件数据**！
5. **数据查库优先**：当分析历史表现、对比或做计划时，**优先调用工具 query_rides_summary 获取真实数据**。
6. **结构化专业输出**：
   - 📊 **车手近期状态主动洞察（含稳态巡航时速、综合停表均速与速度落差分析）**
   - ⚙️ **精准物理运动学计算与齿比/踏频解析（基于巡航时速确定性计算，严禁将停表均速作为巡航基准）**
   - 🎯 **量化目标与专属 4 周执行指南（含红绿灯降档起步控频与膝盖保护）**`;

export async function chatWithCoach(sessionId: string, message: string): Promise<CoachReplyResult> {
  const config = await getAIConfig();
  const riderContext = await getRiderContextPrompt();

  // 取最近 30 条历史，先倒序取最新再反转为正序
  const history = await getCoachMessages(sessionId);
  const recentHistory = history.slice(-30);

  const messages: any[] = [{ role: 'system', content: COACH_SYSTEM_PROMPT(riderContext) }];
  recentHistory.forEach((row) => {
    if (row.role === 'tool') {
      messages.push({ role: 'tool', tool_call_id: row.tool_call_id, content: row.content });
    } else if (row.role === 'assistant' && row.tool_calls) {
      messages.push({
        role: 'assistant',
        content: row.content || '',
        tool_calls: typeof row.tool_calls === 'string' ? JSON.parse(row.tool_calls) : row.tool_calls,
      });
    } else {
      messages.push({ role: row.role, content: row.content });
    }
  });

  messages.push({ role: 'user', content: message });
  await appendMessage(sessionId, { role: 'user', content: message });

  let goalUpdatedData: any = null;
  let profileUpdatedData: any = null;
  let executedToolCalls: any[] = [];
  let finalReply = '';

  for (let loopCount = 0; loopCount < MAX_TOOL_LOOPS; loopCount++) {
    const res = await callAICompletion(config, messages, {
      tools: COACH_TOOLS,
      tool_choice: 'auto',
      temperature: 0.3,
      max_tokens: 4096,
      reasoning_effort: 'none',
    });

    const { content, tool_calls } = await parseAIResponse(res);
    if (tool_calls && tool_calls.length > 0) {
      executedToolCalls = [...executedToolCalls, ...tool_calls];
      messages.push({ role: 'assistant', content: content || '', tool_calls });
      await appendMessage(sessionId, {
        role: 'assistant',
        content: content || '',
        tool_calls,
      });

      for (const tc of tool_calls) {
        const fnName = tc.function.name;
        const fnArgs = JSON.parse(tc.function.arguments || '{}');
        const result = await executeTool(fnName, fnArgs);

        // 捕获副作用供前端回显
        if (fnName === 'set_training_goals') {
          goalUpdatedData = {
            primary_goal: fnArgs.primary_goal,
            weekly_distance_km: fnArgs.weekly_distance_km,
            target_avg_speed_kmh: fnArgs.target_avg_speed_kmh,
            monthly_distance_km: fnArgs.monthly_distance_km,
            coach_notes: fnArgs.coach_notes,
          };
        } else if (fnName === 'update_rider_profile') {
          profileUpdatedData = { ...fnArgs };
        }

        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        await appendMessage(sessionId, {
          role: 'tool',
          content: JSON.stringify(result),
          tool_call_id: tc.id,
          name: fnName,
        });
      }
    } else {
      finalReply = content;
      if (finalReply) {
        await appendMessage(sessionId, {
          role: 'assistant',
          content: finalReply,
          tool_calls: executedToolCalls.length > 0 ? executedToolCalls : undefined,
        });
      }
      break;
    }
  }

  // 兜底：循环用尽仍无回复，单轮再调一次
  if (!finalReply.trim()) {
    const fallbackRes = await callAICompletion(config, [
      { role: 'system', content: COACH_SYSTEM_PROMPT(riderContext) },
      { role: 'user', content: message },
    ], { temperature: 0.4, max_tokens: 4096 });
    const fb = await parseAIResponse(fallbackRes);
    finalReply = fb.content || '教练正在整理分析报告，请稍后再试。';
    await appendMessage(sessionId, { role: 'assistant', content: finalReply });
  }

  // 记忆反思：从用户发言提炼 1 条原子事实
  if (message.length > 6 && (
    message.includes('换了') || message.includes('买了') || message.includes('改装') ||
    message.includes('膝盖') || message.includes('痛') || message.includes('酸') || message.includes('伤') ||
    message.includes('习惯') || message.includes('喜欢') || message.includes('偏好') ||
    message.includes('齿比') || message.includes('胎压') || message.includes('脚踏') || message.includes('坐垫')
  )) {
    try {
      const reflectionRes = await callAICompletion(config, [
        { role: 'system', content: `你是一个严谨的运动档案语义事实提炼专家（遵循 Agentic Memory 规范）。
从车手（用户）最新发言中，提炼出【车手自身】的 1 条持久原子事实。
严禁提取教练说的话、训练课表或长篇大论！每条事实必须是 ≤35 字的精炼陈述。

分类类别：
- health: 身体伤病、膝盖感受或健康底线
- gear: 战车零件改装、齿比习惯、外胎胎压或配件微调
- habit: 骑行时段习惯、路线偏好或作息
- preference: 训练风格喜好或心理态度

必须输出 JSON 格式（无新事实则输出 {}）：
{"category": "health|gear|habit|preference", "memory_key": "unique_snake_case_key", "content": "精炼陈述", "importance": 1-5}` },
        { role: 'user', content: message },
      ], { temperature: 0.1, max_tokens: 150 });

      const { content: extText } = await parseAIResponse(reflectionRes);
      const match = extText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.content && parsed.category && parsed.memory_key && parsed.content.length <= 60) {
          await upsertRiderMemory(
            parsed.category,
            parsed.memory_key,
            parsed.content,
            'coach',
            parsed.importance || 3,
          );
        }
      }
    } catch (err) {
      console.error('Memory reflection error:', err);
    }
  }

  return {
    reply: finalReply,
    goalUpdated: goalUpdatedData,
    profileUpdated: profileUpdatedData,
    toolCalls: executedToolCalls,
  };
}

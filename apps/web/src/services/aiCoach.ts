/**
 * VeloTrack 前端 aiCoach 执教对话编排服务
 * 
 * 职责：编排多轮对话、LLM tool-calling 循环与记忆反思。
 * 数据持久化由 ./coach/coachApi 处理；工具 Schema 与执行由 ./coach/coachTools 处理。
 */

import { getAIConfig, callAICompletion, parseAIResponse } from './aiClient';
import { getRiderContextPrompt, upsertRiderMemory } from './riderService';
import {
  type CoachSession,
  type CoachMessage,
  getCoachSessions,
  getCoachMessages,
  appendMessage,
  deleteCoachSession,
} from './coach/coachApi';
import { COACH_TOOLS, executeCoachTool } from './coach/coachTools';

// 重新导出数据类型与 API，保持对外接口向前兼容
export type { CoachSession, CoachMessage };
export { getCoachSessions, getCoachMessages, deleteCoachSession };

const MAX_TOOL_LOOPS = 6;

export interface CoachReplyResult {
  reply: string;
  goalUpdated: any;
  profileUpdated: any;
  toolCalls: any[];
}

export const COACH_SYSTEM_PROMPT = (riderContext: string) => `你是由世界顶级自行车职业车队运动表现总监、运动生物力学专家联合调校的 **VeloTrack 专属私人骑行教练**。

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

/**
 * 触发记忆反思，从用户发言中提炼持久原子事实
 */
async function triggerMemoryReflection(message: string, config: any): Promise<void> {
  if (message.length <= 6) return;
  const triggerKeywords = [
    '换了', '买了', '改装', '膝盖', '痛', '酸', '伤',
    '习惯', '喜欢', '偏好', '齿比', '胎压', '脚踏', '坐垫',
  ];
  if (!triggerKeywords.some((kw) => message.includes(kw))) return;

  try {
    const reflectionRes = await callAICompletion(config, [
      {
        role: 'system',
        content: `你是一个严谨的运动档案语义事实提炼专家（遵循 Agentic Memory 规范）。
从车手（用户）最新发言中，提炼出【车手自身】的 1 条持久原子事实。
严禁提取教练说的话、训练课表或长篇大论！每条事实必须是 ≤35 字的精炼陈述。

分类类别：
- health: 身体伤病、膝盖感受或健康底线
- gear: 战车零件改装、齿比习惯、外胎胎压或配件微调
- habit: 骑行时段习惯、路线偏好或作息
- preference: 训练风格喜好或心理态度

必须输出 JSON 格式（无新事实则输出 {}）：
{"category": "health|gear|habit|preference", "memory_key": "unique_snake_case_key", "content": "精炼陈述", "importance": 1-5}`,
      },
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
          parsed.importance || 3
        );
      }
    }
  } catch (err) {
    console.error('Memory reflection error:', err);
  }
}

/**
 * 主对话多轮执教循环
 */
export async function chatWithCoach(sessionId: string, message: string): Promise<CoachReplyResult> {
  const config = await getAIConfig();
  const riderContext = await getRiderContextPrompt();

  // 取最近 30 条历史，正序供给大模型
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
        const result = await executeCoachTool(fnName, fnArgs);

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

  // 记忆反思异步触发
  await triggerMemoryReflection(message, config);

  return {
    reply: finalReply,
    goalUpdated: goalUpdatedData,
    profileUpdated: profileUpdatedData,
    toolCalls: executedToolCalls,
  };
}

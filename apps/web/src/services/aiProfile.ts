/**
 * VeloTrack 前端 aiProfile 服务
 *
 * 从 packages/api/src/routes/aiProfile.ts 的 interview chat 平移。
 * 车手建档评估对话 Agent：通过问答引导车手建立档案，
 * 调用 update_profile 工具局部合并更新（保留既有外胎/配件）。
 */

import { getAIConfig, callAICompletion, parseAIResponse } from './aiClient';
import { getRiderProfile, updateRiderProfile } from './riderService';

const INTERVIEW_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'update_profile',
      description: '当车手透露了体重、身高、车型、齿比、外胎、车重、其他改装件、伤病或目标时自动更新档案',
      parameters: {
        type: 'object',
        properties: {
          weight_kg: { type: 'number', description: '车手体重(kg)' },
          height_cm: { type: 'number', description: '车手身高(cm)' },
          current_bike: { type: 'string', description: '主力战车型号，如"大行 P8"' },
          gear_ratio: { type: 'string', description: '齿比与变速配置，如"46T牙盘 + 11-28T 7速飞轮"' },
          tires: { type: 'string', description: '外胎规格与胎压，如"马牌 Contact Urban 2.0 轮胎 (75-80 psi)"' },
          bike_weight_kg: { type: 'number', description: '战车净重(kg)' },
          custom_specs: { type: 'object', description: '任意其他自定义硬件/配件/生理属性键值对，例如 {"pedals": "平踏", "saddle": "舒适座垫"}' },
          injuries_notes: { type: 'string', description: '既往旧伤或身体不适备忘' },
          primary_goal: { type: 'string', description: '阶段训练目标' },
        },
      },
    },
  },
];

export interface InterviewReplyResult {
  reply: string;
  updatedFields: any;
}

export async function interviewChat(message: string, history: any[] = []): Promise<InterviewReplyResult> {
  if (!message) throw new Error('Message is required');

  const config = await getAIConfig();
  const currentProfile = await getRiderProfile();

  const systemPrompt = `你是一名专业、严谨且温和的职业车队建档评估师。你的任务是通过与车手亲切问答，协助其建立并精准维护个人体能与战车硬件档案。

【当前车手档案现状】：
- 车手: ${currentProfile.name} (体重: ${currentProfile.weight_kg}kg, 身高: ${currentProfile.height_cm}cm, FTP: ${currentProfile.ftp_watts}W)
- 主力战车: ${currentProfile.current_bike} (车重: ${currentProfile.bike_weight_kg || 11.5}kg)
- 战车齿比: ${currentProfile.gear_ratio || '46T牙盘 + 11-28T 7速飞轮'}
- 战车外胎: ${currentProfile.tires || '马牌 Contact Urban 2.0 轮胎 (75-80 psi)'}
- 自定义硬件配件: ${typeof currentProfile.custom_specs === 'string' ? currentProfile.custom_specs : JSON.stringify(currentProfile.custom_specs || {})}
- 伤病备忘: ${currentProfile.injuries_notes || '暂无伤病'}
- 核心目标: ${currentProfile.primary_goal || '提高均速'}

【关键执教与工具调用规则（铁律）】：
1. **器材属性独立与局部保留原则**：
   - 齿比 (gear_ratio)、外胎 (tires)、车重 (bike_weight_kg) 和其他配件 (custom_specs) 为独立分立属性。
   - **当车手只提及修改齿比时（如"46t牙盘+11-28t飞轮，改成了7速"），你只传入 gear_ratio，系统会自动保留原有的外胎（如马牌 Contact Urban 2.0）等所有已有属性，绝对不能把外胎弄丢！**
   - 当车手提及脚踏、轮组、车把、码表等任意其他配件时，传入 custom_specs 键值对对象（如 {"pedals": "平踏", "wheelset": "20寸406"}）。
2. **主动调用工具更新**：
   - 当用户回答了关于体重、身高、车型、齿比、外胎、车重、改装件、伤病或目标的信息时，**第一时间调用工具 update_profile**。
3. **回复确认**：
   - 调用工具后，用 1~2 句话给予鼓励，并清晰确认已更新的具体项目及已保留的既有配置。`;

  const messages: any[] = [{ role: 'system', content: systemPrompt }];
  if (Array.isArray(history)) {
    history.slice(-8).forEach((h: any) => {
      messages.push({ role: h.role, content: h.content });
    });
  }
  messages.push({ role: 'user', content: message });

  const res = await callAICompletion(config, messages, {
    tools: INTERVIEW_TOOLS,
    tool_choice: 'auto',
    temperature: 0.3,
    max_tokens: 1500,
  });

  let updatedFields: any = {};
  const { content, tool_calls } = await parseAIResponse(res);

  if (tool_calls && tool_calls.length > 0) {
    for (const tc of tool_calls) {
      if (tc.function.name === 'update_profile') {
        const args = JSON.parse(tc.function.arguments || '{}');
        updatedFields = { ...args };
        await updateRiderProfile(args);
      }
    }

    messages.push({
      role: 'assistant',
      content: content || '',
      tool_calls,
    });
    messages.push({
      role: 'tool',
      tool_call_id: tool_calls[0].id,
      content: JSON.stringify({ success: true, updated: updatedFields }),
    });

    const turn2Res = await callAICompletion(config, messages, { temperature: 0.3, max_tokens: 800 });
    const turn2 = await parseAIResponse(turn2Res);
    return { reply: turn2.content || '已更新你的档案。', updatedFields };
  }

  return { reply: content || '已收到你的信息。', updatedFields };
}

import { Hono } from 'hono';
import type { Bindings } from '../types';
import { getAIConfig, callAICompletion } from '../services/aiClient';
import { 
  getRiderProfile, 
  updateRiderProfile, 
  getTrainingGoals,
  updateTrainingGoals,
  getGoalMilestones,
  getRiderMemories, 
  upsertRiderMemory, 
  deleteRiderMemory 
} from '../services/riderService';

export const aiProfileRouter = new Hono<{ Bindings: Bindings }>();

// 1. 获取车手档案、记忆与目标
aiProfileRouter.get('/rider/profile', async (c) => {
  try {
    const profile = await getRiderProfile(c.env.DB);
    const memories = await getRiderMemories(c.env.DB);
    const goals = await getTrainingGoals(c.env.DB);
    const milestones = await getGoalMilestones(c.env.DB, 5);
    return c.json({ profile, memories, goals, milestones });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 2. 更新车手档案 (支持任意扩展硬件字段)
aiProfileRouter.put('/rider/profile', async (c) => {
  try {
    const body = await c.req.json();
    const updated = await updateRiderProfile(c.env.DB, body);
    return c.json({ success: true, message: '车手档案已保存', profile: updated });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 3. 获取训练目标与演进里程碑
aiProfileRouter.get('/goals', async (c) => {
  try {
    const goals = await getTrainingGoals(c.env.DB);
    const profile = await getRiderProfile(c.env.DB);
    const milestones = await getGoalMilestones(c.env.DB, 5);
    return c.json({ goals, profile, milestones });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 4. 更新训练目标
aiProfileRouter.put('/goals', async (c) => {
  try {
    const body = await c.req.json();
    const updated = await updateTrainingGoals(c.env.DB, body);
    if (body.primary_goal) {
      await updateRiderProfile(c.env.DB, { primary_goal: body.primary_goal });
    }
    return c.json({ success: true, message: '训练目标已保存', goals: updated });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 5. 新增/更新原子车手记忆 (L2 Semantic Memory)
aiProfileRouter.post('/rider/memories', async (c) => {
  try {
    const { category, memory_key, content, source, importance } = await c.req.json();
    if (!content || !content.trim()) {
      return c.json({ error: 'Memory content cannot be empty' }, 400);
    }
    const id = await upsertRiderMemory(
      c.env.DB, 
      category || 'habit', 
      memory_key || 'custom_fact', 
      content.trim(), 
      source || 'manual',
      Number(importance) || 3
    );
    return c.json({ success: true, id });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 6. 删除车手记忆
aiProfileRouter.delete('/rider/memories/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await deleteRiderMemory(c.env.DB, id);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 7. 车手建档评估对话 Agent (Interview Agent)
aiProfileRouter.post('/rider/interview/chat', async (c) => {
  try {
    const { message, history } = await c.req.json();
    if (!message) return c.json({ error: 'Message is required' }, 400);

    const config = await getAIConfig(c.env.DB, c.env);
    const currentProfile = await getRiderProfile(c.env.DB);

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
   - **当车手只提及修改齿比时（如“46t牙盘+11-28t飞轮，改成了7速”），你只传入 gear_ratio，系统会自动保留原有的外胎（如马牌 Contact Urban 2.0）等所有已有属性，绝对不能把外胎弄丢！**
   - 当车手提及脚踏、轮组、车把、码表等任意其他配件时，传入 custom_specs 键值对对象（如 {"pedals": "平踏", "wheelset": "20寸406"}）。
2. **主动调用工具更新**：
   - 当用户回答了关于体重、身高、车型、齿比、外胎、车重、改装件、伤病或目标的信息时，**第一时间调用工具 update_profile**。
3. **回复确认**：
   - 调用工具后，用 1~2 句话给予鼓励，并清晰确认已更新的具体项目及已保留的既有配置。`;

    const tools = [
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
              primary_goal: { type: 'string', description: '阶段训练目标' }
            }
          }
        }
      }
    ];

    const messages: any[] = [{ role: 'system', content: systemPrompt }];
    if (Array.isArray(history)) {
      history.slice(-8).forEach((h: any) => {
        messages.push({ role: h.role, content: h.content });
      });
    }
    messages.push({ role: 'user', content: message });

    const res = await callAICompletion(config, messages, { tools, tool_choice: 'auto', temperature: 0.3, max_tokens: 1500 });

    let updatedFields: any = {};
    if (res.ok) {
      const data: any = await res.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;

      if (msg?.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          if (tc.function.name === 'update_profile') {
            const args = JSON.parse(tc.function.arguments || '{}');
            updatedFields = { ...args };
            await updateRiderProfile(c.env.DB, args);
          }
        }

        messages.push({
          role: 'assistant',
          content: msg.content || '',
          tool_calls: msg.tool_calls
        });
        messages.push({
          role: 'tool',
          tool_call_id: msg.tool_calls[0].id,
          content: JSON.stringify({ success: true, updated: updatedFields })
        });

        const turn2Res = await callAICompletion(config, messages, { temperature: 0.3, max_tokens: 800 });
        if (turn2Res.ok) {
          const turn2Data: any = await turn2Res.json();
          const reply = turn2Data.choices?.[0]?.message?.content || '已更新你的档案。';
          return c.json({ reply, updatedFields });
        }
      }

      const reply = msg?.content || '已收到你的信息。';
      return c.json({ reply, updatedFields });
    }

    return c.json({ reply: '已记录你的回答。', updatedFields: {} });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

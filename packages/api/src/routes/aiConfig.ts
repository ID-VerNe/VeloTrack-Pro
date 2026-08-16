import { Hono } from 'hono';
import type { Bindings } from '../types';
import { ensureTables } from '../services/dbInit';
import { getAIConfig, callAICompletion } from '../services/aiClient';

export const aiConfigRouter = new Hono<{ Bindings: Bindings }>();

// 1. 获取 AI 配置
aiConfigRouter.get('/config', async (c) => {
  try {
    const config = await getAIConfig(c.env.DB);
    return c.json({ config });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 2. 更新 AI 配置
aiConfigRouter.put('/config', async (c) => {
  try {
    const body = await c.req.json();
    const { base_url, model_name, api_key } = body;
    await ensureTables(c.env.DB);

    await c.env.DB.prepare(`
      INSERT INTO ai_config (id, base_url, model_name, api_key, updated_at)
      VALUES (1, ?, ?, ?, unixepoch())
      ON CONFLICT(id) DO UPDATE SET
        base_url = excluded.base_url,
        model_name = excluded.model_name,
        api_key = excluded.api_key,
        updated_at = excluded.updated_at
    `).bind((base_url || '').trim(), (model_name || '').trim(), (api_key || '').trim()).run();

    return c.json({ success: true, message: '配置已成功保存' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 3. 测试 AI 接口连通性
aiConfigRouter.post('/test-connection', async (c) => {
  try {
    const config = await getAIConfig(c.env.DB);
    const body = await c.req.json().catch(() => ({}));
    const testConfig = {
      base_url: body.base_url || config.base_url,
      model_name: body.model_name || config.model_name,
      api_key: body.api_key || config.api_key
    };

    const startTime = Date.now();
    const res = await callAICompletion(testConfig, [
      { role: 'system', content: 'You are VeloTrack Coach. Respond in one short sentence in Chinese.' },
      { role: 'user', content: '你好，测试连接。' }
    ], { max_tokens: 100 });

    const latencyMs = Date.now() - startTime;
    if (!res.ok) {
      const errText = await res.text();
      return c.json({ success: false, error: `HTTP ${res.status}: ${errText}`, latencyMs }, 400);
    }

    const data: any = await res.json();
    const reply = data.choices?.[0]?.message?.content || '连接成功';
    return c.json({ success: true, latencyMs, model: testConfig.model_name, reply });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

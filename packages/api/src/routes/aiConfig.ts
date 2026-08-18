import { Hono } from 'hono';
import type { Bindings } from '../types';
import { ensureTables } from '../services/dbInit';
import { getAIConfig, callAICompletion, AIServiceError } from '../services/aiClient';

export const aiConfigRouter = new Hono<{ Bindings: Bindings }>();

// 对 API Key 脱敏：仅保留前 3 位与后 4 位，用于前端回显确认
function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 3)}****${key.slice(-4)}`;
}

// 校验 base_url：必须是合法的 http/https URL，禁止其他协议
function isValidBaseUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// 1. 获取 AI 配置（api_key 脱敏回显，不向客户端泄露完整密钥）
aiConfigRouter.get('/config', async (c) => {
  try {
    const config = await getAIConfig(c.env.DB, c.env);
    return c.json({
      config: {
        base_url: config.base_url,
        model_name: config.model_name,
        api_key: maskApiKey(config.api_key),
        api_key_configured: Boolean(config.api_key)
      }
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 2. 更新 AI 配置（base_url 需通过 URL 合法性校验，缓解 SSRF）
aiConfigRouter.put('/config', async (c) => {
  try {
    const body = await c.req.json();
    const { base_url, model_name, api_key } = body;

    if (!isValidBaseUrl(base_url)) {
      return c.json({ error: 'base_url 必须是合法的 http/https URL' }, 400);
    }
    if (!model_name || !String(model_name).trim()) {
      return c.json({ error: 'model_name 不能为空' }, 400);
    }

    await ensureTables(c.env.DB);

    // api_key 为空或为脱敏回显值（含 ****）时，保留数据库中已存的 key 不覆盖
    const trimmedKey = String(api_key || '').trim();
    const keepExisting = !trimmedKey || trimmedKey.includes('****');

    await c.env.DB.prepare(`
      INSERT INTO ai_config (id, base_url, model_name, api_key, updated_at)
      VALUES (1, ?, ?, ?, unixepoch())
      ON CONFLICT(id) DO UPDATE SET
        base_url = excluded.base_url,
        model_name = excluded.model_name,
        api_key = CASE WHEN excluded.api_key = '' THEN ai_config.api_key ELSE excluded.api_key END,
        updated_at = excluded.updated_at
    `).bind(base_url.trim(), String(model_name).trim(), keepExisting ? '' : trimmedKey).run();

    return c.json({ success: true, message: '配置已成功保存' });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// 3. 测试 AI 接口连通性（上游错误文本截断，避免回显内部细节）
aiConfigRouter.post('/test-connection', async (c) => {
  try {
    const config = await getAIConfig(c.env.DB, c.env);
    const body = await c.req.json().catch(() => ({}));
    const testBaseUrl = body.base_url || config.base_url;
    if (!isValidBaseUrl(testBaseUrl)) {
      return c.json({ success: false, error: 'base_url 无效' }, 400);
    }
    const testConfig = {
      base_url: String(testBaseUrl),
      model_name: body.model_name || config.model_name,
      api_key: config.api_key // 统一使用已保存/Secret 的 key，不信任客户端传入
    };

    const startTime = Date.now();
    const res = await callAICompletion(testConfig, [
      { role: 'system', content: 'You are VeloTrack Coach. Respond in one short sentence in Chinese.' },
      { role: 'user', content: '你好，测试连接。' }
    ], { max_tokens: 100 });

    const latencyMs = Date.now() - startTime;
    if (!res.ok) {
      const errText = (await res.text()).slice(0, 300); // 截断，防泄露上游细节
      return c.json({ success: false, error: `HTTP ${res.status}: ${errText}`, latencyMs }, 400);
    }

    const data: any = await res.json();
    const reply = data.choices?.[0]?.message?.content || '连接成功';
    return c.json({ success: true, latencyMs, model: testConfig.model_name, reply });
  } catch (err: any) {
    if (err instanceof AIServiceError) {
      return c.json({ success: false, error: err.message }, 502);
    }
    return c.json({ success: false, error: err.message }, 500);
  }
});

import { ensureTables } from './dbInit';
import type { Bindings } from '../types';

export interface AIConfig {
  base_url: string;
  model_name: string;
  api_key: string;
}

// AI 外呼超时与重试配置
const AI_TIMEOUT_MS = 30_000;
const AI_MAX_RETRIES = 1; // 网络类错误重试 1 次

/**
 * 获取 AI 配置。密钥解析优先级：
 * 1. D1 ai_config 表中保存的 key
 * 2. Worker Secret AI_API_KEY（wrangler secret put AI_API_KEY）
 * 3. 空字符串（调用会在上游返回 401，属预期失败）
 */
export async function getAIConfig(db: D1Database, env?: Bindings): Promise<AIConfig> {
  await ensureTables(db);
  const row = await db.prepare('SELECT base_url, model_name, api_key FROM ai_config WHERE id = 1').first<any>();
  const dbKey = (row?.api_key || '').trim();
  return {
    base_url: (row?.base_url || '').trim(),
    model_name: (row?.model_name || 'deepseek-v4-flash').trim(),
    api_key: dbKey || (env?.AI_API_KEY || '').trim()
  };
}

export function resolveCompletionsUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  return clean.endsWith('/v1') ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
}

export async function sha256(text: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class AIServiceError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export async function callAICompletion(
  config: AIConfig,
  messages: any[],
  options: {
    tools?: any[];
    tool_choice?: string;
    temperature?: number;
    max_tokens?: number;
  } = {}
): Promise<Response> {
  if (!config.base_url) {
    throw new AIServiceError('AI base_url 未配置，请先在管理端完成 AI 配置');
  }
  if (!config.api_key) {
    throw new AIServiceError('AI api_key 未配置，请通过 Worker Secret AI_API_KEY 或管理端配置提供');
  }

  const url = resolveCompletionsUrl(config.base_url);
  const requestBody = JSON.stringify({
    model: config.model_name,
    messages,
    tools: options.tools,
    tool_choice: options.tool_choice,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 2500
  });

  // 带超时的请求 + 网络类错误（超时/连接失败）重试，避免上游挂起导致请求永久 pending
  let lastError: unknown;
  for (let attempt = 0; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      return await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.api_key}`
        },
        body: requestBody,
        signal: AbortSignal.timeout(AI_TIMEOUT_MS)
      });
    } catch (err) {
      lastError = err;
      // HTTP 错误状态码不会走到这里（fetch 对 4xx/5xx 不抛异常），仅网络/超时错误重试
      if (attempt < AI_MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1))); // 简单退避
      }
    }
  }
  throw new AIServiceError(
    `AI 服务连接失败（已重试 ${AI_MAX_RETRIES} 次）：${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

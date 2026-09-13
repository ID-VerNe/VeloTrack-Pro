/**
 * VeloTrack 前端 AI 服务层
 *
 * 从 packages/api/src/services/aiClient.ts + routes/ai*.ts 平移而来。
 * 后端只做数据 CRUD；所有 AI 调用逻辑（prompt 拼装、tool-calling 循环、记忆反思）
 * 移到前端，直调用户的 AI Gateway（https://api-gateway.yuuverne.site）。
 *
 * base_url 与 model_name 从后端 /api/ai/config 读取（跨设备同步）；
 * api_key（Gateway team key）存浏览器 localStorage，不进后端。
 */

import { authFetch } from '../utils/activity/adminApiClient';

const AI_TIMEOUT_MS = 120_000;
// 10 次重试（共 11 次尝试）。Gateway 与其他调用方共享上游配额，
// 429 是正常限流而非故障，靠指数退避异步等待而非失败。
const AI_MAX_RETRIES = 10;
// 退避上限 60s，避免单次重试等过久拖垮 UX
const AI_MAX_BACKOFF_MS = 60_000;

export interface AIConfig {
  base_url: string;
  model_name: string;
}

export class AIServiceError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'AIServiceError';
  }
}

/** Gateway team key 存 localStorage（不进后端，不进 git） */
const GATEWAY_KEY_STORAGE = 'velotrack_ai_gateway_key';

export function getGatewayKey(): string {
  return localStorage.getItem(GATEWAY_KEY_STORAGE) || '';
}

export function setGatewayKey(key: string): void {
  if (key) localStorage.setItem(GATEWAY_KEY_STORAGE, key);
  else localStorage.removeItem(GATEWAY_KEY_STORAGE);
}

/** 从后端读取 base_url + model_name（后端只存这俩，不存 key） */
export async function getAIConfig(): Promise<AIConfig> {
  const res = await fetch('/api/ai/config');
  if (!res.ok) {
    throw new AIServiceError('读取 AI 配置失败：HTTP ' + res.status);
  }
  const data = await res.json();
  return {
    base_url: (data.config?.base_url || '').trim(),
    model_name: (data.config?.model_name || 'glm-5.2').trim(),
  };
}

/** 把 base_url + model_name 写回后端 ai_config（跨设备同步；key 不走后端） */
export async function updateAIConfig(config: AIConfig): Promise<void> {
  const res = await authFetch('/api/ai/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_url: config.base_url, model_name: config.model_name }),
  });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch {}
    throw new AIServiceError('保存 AI 配置失败：' + msg);
  }
}

/**
 * 测试与 Gateway 的连通性：用当前 key 调 GET /v1/models。
 * 不消耗 chat token，只验证 base_url + key + 网络可达。
 * 返回可用 model 列表（前端可据此校验 model_name 是否在列）。
 */
export async function testGatewayConnection(
  config: AIConfig,
  apiKey: string,
): Promise<string[]> {
  if (!config.base_url) {
    throw new AIServiceError('base_url 未配置');
  }
  if (!apiKey) {
    throw new AIServiceError('Gateway key 未配置');
  }
  const clean = config.base_url.trim().replace(/\/+$/, '');
  const modelsUrl = clean.endsWith('/v1') ? `${clean}/models` : `${clean}/v1/models`;
  const res = await fetch(modelsUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new AIServiceError('Gateway 拒绝鉴权（HTTP ' + res.status + '）：key 无效或无权限');
    }
    throw new AIServiceError('Gateway 连通失败：HTTP ' + res.status);
  }
  const data = await res.json();
  const models: string[] = Array.isArray(data?.data)
    ? data.data.map((m: any) => m?.id).filter(Boolean)
    : [];
  return models;
}

export function resolveCompletionsUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  return clean.endsWith('/v1') ? `${clean}/chat/completions` : `${clean}/v1/chat/completions`;
}

export async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface CallOptions {
  tools?: any[];
  tool_choice?: string;
  temperature?: number;
  max_tokens?: number;
  retries?: number;
  reasoning_effort?: string;
}

/**
 * 调用 AI Gateway /v1/chat/completions，带超时与 429/5xx 重试。
 * key 优先级：localStorage 的 Gateway team key（唯一来源，后端不存 key）。
 */
export async function callAICompletion(
  config: AIConfig,
  messages: any[],
  options: CallOptions = {}
): Promise<Response> {
  if (!config.base_url) {
    throw new AIServiceError('AI base_url 未配置，请先在管理端完成 AI 配置');
  }
  const apiKey = getGatewayKey();
  if (!apiKey) {
    throw new AIServiceError('AI Gateway key 未配置，请在设置中填入 Gateway team key');
  }

  const url = resolveCompletionsUrl(config.base_url);
  const payload: Record<string, any> = {
    model: config.model_name,
    messages,
    tools: options.tools,
    tool_choice: options.tool_choice,
    temperature: options.temperature ?? 0.3,
    max_tokens: options.max_tokens ?? 2500,
  };
  const reasoningEffort = options.reasoning_effort ?? (config.model_name.toLowerCase().includes('glm-5') ? 'none' : undefined);
  if (reasoningEffort !== undefined) {
    payload.reasoning_effort = reasoningEffort;
  }
  const requestBody = JSON.stringify(payload);

  const maxRetries = options.retries ?? AI_MAX_RETRIES;
  let lastError: unknown;
  let lastResponse: Response | null = null;

  /**
   * 指数退避：base * 2^attempt，加 ±25% jitter 避免多调用方同步重试打满上游，
   * 上限 AI_MAX_BACKOFF_MS。429 是 Gateway 与其他调用方共享配额的正常限流，
   * 异步等待而非失败。
   */
  const backoffMs = (attempt: number): number => {
    const exp = Math.min(800 * 2 ** attempt, AI_MAX_BACKOFF_MS);
    const jitter = exp * (0.75 + Math.random() * 0.5);
    return Math.round(jitter);
  };

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: requestBody,
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });

      // 429 限流或 5xx 暂时性服务端错误时指数退避重试
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        lastResponse = res;
        await new Promise((r) => setTimeout(r, backoffMs(attempt)));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, backoffMs(attempt)));
      }
    }
  }

  if (lastResponse) return lastResponse;
  throw new AIServiceError(
    `AI 服务连接失败（已重试 ${maxRetries} 次）：${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

/** 解析 AI 响应为 { content, tool_calls }，处理空响应。
 * 注意：glm-5.2 会先输出 reasoning_content 思维链，max_tokens 不够时 content
 * 仍是空串（所有 token 都被思维链吃掉）。故 content 为空时回退到 reasoning_content
 * 并交给调用方截取，避免短 max_tokens 场景下拿到空标题。 */
export async function parseAIResponse(res: Response): Promise<{
  content: string;
  tool_calls?: any[];
  finish_reason?: string;
}> {
  if (!res.ok) {
    const errText = (await res.text().catch(() => '')).slice(0, 300);
    throw new AIServiceError(`AI service error: HTTP ${res.status}: ${errText}`, res.status);
  }
  const data: any = await res.json();
  const choice = data.choices?.[0];
  const msg = choice?.message;
  return {
    content: msg?.content || '',
    tool_calls: msg?.tool_calls,
    finish_reason: choice?.finish_reason,
  };
}

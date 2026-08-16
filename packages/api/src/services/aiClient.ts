import { ensureTables } from './dbInit';

export interface AIConfig {
  base_url: string;
  model_name: string;
  api_key: string;
}

export async function getAIConfig(db: D1Database): Promise<AIConfig> {
  await ensureTables(db);
  const row = await db.prepare('SELECT base_url, model_name, api_key FROM ai_config WHERE id = 1').first<any>();
  return {
    base_url: (row?.base_url || 'http://localhost:37183/v1').trim(),
    model_name: (row?.model_name || 'deepseek-v4-flash').trim(),
    api_key: (row?.api_key || 'sk-fU0SuTBSzwvd6hVyVDE6cQkT3R7QFVAikpYaetvDOZs9gOJp').trim()
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

export async function callAICompletion(
  config: AIConfig,
  messages: any[],
  options: {
    tools?: any[];
    tool_choice?: string;
    temperature?: number;
    max_tokens?: number;
  } = {}
) {
  const url = resolveCompletionsUrl(config.base_url);
  return await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.api_key}`
    },
    body: JSON.stringify({
      model: config.model_name,
      messages,
      tools: options.tools,
      tool_choice: options.tool_choice,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.max_tokens ?? 2500
    })
  });
}

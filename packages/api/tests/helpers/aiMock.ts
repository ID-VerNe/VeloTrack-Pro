/**
 * AI 外呼 fetch mock 辅助
 * callAICompletion 使用全局 fetch；测试中通过 vi.stubGlobal 注入受控响应。
 */
import { vi } from 'vitest';

export interface AiMockOptions {
  /** 聊天补全响应内容 */
  content?: string;
  /** 是否模拟上游 HTTP 错误状态 */
  httpStatus?: number;
  /** 是否模拟网络层异常（fetch reject） */
  networkError?: boolean;
  /** tool_calls 响应（用于 coach/interview 工具调用链路） */
  toolCalls?: any[];
  /** 每轮调用返回的响应序列（按调用顺序消费；未提供则每次返回相同） */
  sequence?: any[];
}

function toOpenAIResponse(overrides: any) {
  const choices = overrides.toolCalls
    ? [{ index: 0, message: { role: 'assistant', content: overrides.content || '', tool_calls: overrides.toolCalls } }]
    : [{ index: 0, message: { role: 'assistant', content: overrides.content || '' } }];
  return new Response(JSON.stringify({ choices }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** stub 全局 fetch，返回可控的 OpenAI 兼容响应；返回原始 fetch（供断言调用次数） */
export function mockAiFetch(options: AiMockOptions = {}) {
  const calls: { url: string; body: any }[] = [];
  const fetchMock = vi.fn(async (input: any, init?: any) => {
    calls.push({
      url: String(input),
      body: init?.body ? JSON.parse(init.body as string) : null,
    });

    if (options.networkError) {
      throw new TypeError('fetch failed');
    }
    if (options.sequence && options.sequence.length > 0) {
      const next = options.sequence.shift()!;
      if (next.httpStatus) {
        return new Response(JSON.stringify({ error: 'upstream error' }), { status: next.httpStatus });
      }
      if (next.networkError) throw new TypeError('fetch failed');
      return toOpenAIResponse(next);
    }
    if (options.httpStatus) {
      return new Response(JSON.stringify({ error: 'upstream error' }), { status: options.httpStatus });
    }
    return toOpenAIResponse(options);
  });

  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

/** 恢复全局 fetch */
export function unstubAiFetch() {
  vi.unstubAllGlobals();
}

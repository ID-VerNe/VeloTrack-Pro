/**
 * VeloTrack AI Coach 会话与消息持久化接口
 * 负责与后端 /api/ai/coach/* REST 端点交互
 */

import { getAdminToken } from '../../utils/activity/adminApiClient';

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

export async function appendMessage(sessionId: string, msg: CoachMessage): Promise<void> {
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

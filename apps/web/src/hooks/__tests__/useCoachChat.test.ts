import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCoachChat, DEFAULT_WELCOME_MSG } from '../useCoachChat';
import * as aiCoachService from '../../services/aiCoach';
import * as riderService from '../../services/riderService';

vi.mock('../../services/aiCoach', () => ({
  getCoachSessions: vi.fn(),
  getCoachMessages: vi.fn(),
  deleteCoachSession: vi.fn(),
  chatWithCoach: vi.fn(),
}));

vi.mock('../../services/riderService', () => ({
  getRiderProfile: vi.fn(),
}));

describe('useCoachChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (aiCoachService.getCoachSessions as any).mockResolvedValue([
      { id: 'coach_main', title: '主要会话', updated_at: 1000 },
    ]);
    (aiCoachService.getCoachMessages as any).mockResolvedValue([]);
    (aiCoachService.deleteCoachSession as any).mockResolvedValue(true);
    (riderService.getRiderProfile as any).mockResolvedValue({
      weight_kg: 72,
      current_bike: '大行 P8 改装版',
    });
  });

  it('初始挂载加载历史消息与车手档案', async () => {
    const { result } = renderHook(() => useCoachChat());

    // 默认欢迎语
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe('welcome');
    expect(result.current.sessionId).toBe('coach_main');
  });

  it('handleNewSession 创建新会话并重置消息列表', () => {
    const { result } = renderHook(() => useCoachChat());

    act(() => {
      result.current.handleNewSession();
    });

    expect(result.current.sessionId).toMatch(/^session_/);
    expect(result.current.messages[0]).toEqual(DEFAULT_WELCOME_MSG);
  });

  it('handleSend 发送用户消息并追加助手回复', async () => {
    (aiCoachService.chatWithCoach as any).mockResolvedValue({
      reply: '建议保持踏频在 85~90 rpm',
      toolCalls: [],
      goalUpdated: false,
      profileUpdated: false,
    });

    const { result } = renderHook(() => useCoachChat());
    await waitFor(() => expect(result.current.isSessionLoaded).toBe(true));

    await act(async () => {
      await result.current.handleSend('请问踏频多少合适？');
    });

    expect(result.current.messages).toHaveLength(3); // welcome, user, assistant
    expect(result.current.messages[1].role).toBe('user');
    expect(result.current.messages[1].content).toBe('请问踏频多少合适？');
    expect(result.current.messages[2].role).toBe('assistant');
    expect(result.current.messages[2].content).toBe('建议保持踏频在 85~90 rpm');
  });

  it('删除会话请求与确认流程', async () => {
    const { result } = renderHook(() => useCoachChat());

    act(() => {
      result.current.handleRequestDeleteSession('session_test');
    });

    expect(result.current.sessionToDelete).toBe('session_test');

    await act(async () => {
      await result.current.handleConfirmDeleteSession();
    });

    expect(aiCoachService.deleteCoachSession).toHaveBeenCalledWith('session_test');
    expect(result.current.sessionToDelete).toBeNull();
  });
});

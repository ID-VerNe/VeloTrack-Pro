import { describe, it, expect } from 'vitest';
import { detectChatAction } from '../chatActionDetector';

describe('detectChatAction', () => {
  it('detects goal action via tool_calls string', () => {
    const res = detectChatAction({
      role: 'assistant',
      content: 'Here is your new plan.',
      tool_calls: '[{"function": {"name": "set_training_goals"}}]',
    });
    expect(res.isGoalAction).toBe(true);
    expect(res.actionType).toBe('goal');
  });

  it('detects goal action via tool_calls array', () => {
    const res = detectChatAction({
      role: 'assistant',
      content: 'Here is your plan.',
      tool_calls: [{ function: { name: 'set_training_goals' } }],
    });
    expect(res.isGoalAction).toBe(true);
    expect(res.actionType).toBe('goal');
  });

  it('detects goal action via heuristic assistant content', () => {
    const res = detectChatAction({
      role: 'assistant',
      content: '根据你的情况，目标已生效，加油！',
    });
    expect(res.isGoalAction).toBe(true);
    expect(res.actionType).toBe('goal');
  });

  it('detects profile action via tool_calls and heuristics', () => {
    const res1 = detectChatAction({
      role: 'assistant',
      content: 'Done',
      tool_calls: '[{"function": {"name": "update_rider_profile"}}]',
    });
    expect(res1.isProfileAction).toBe(true);
    expect(res1.actionType).toBe('profile');

    const res2 = detectChatAction({
      role: 'assistant',
      content: '战车硬件配置已成功更新！',
    });
    expect(res2.isProfileAction).toBe(true);
    expect(res2.actionType).toBe('profile');
  });

  it('ignores heuristic keywords in user messages', () => {
    const res = detectChatAction({
      role: 'user',
      content: '我想问目标已生效了吗？',
    });
    expect(res.isGoalAction).toBe(false);
    expect(res.actionType).toBe('none');
  });

  it('returns none when no actions are detected', () => {
    const res = detectChatAction({
      role: 'assistant',
      content: '今天天气不错，建议进行有氧耐力骑行。',
    });
    expect(res.isGoalAction).toBe(false);
    expect(res.isProfileAction).toBe(false);
    expect(res.actionType).toBe('none');
  });
});

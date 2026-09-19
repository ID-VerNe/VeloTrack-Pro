/**
 * AI 对话消息中的系统动作检测器（识别目标同步与车辆档案更新）
 */

export interface ChatMessageActionSource {
  role: string;
  content: string;
  tool_calls?: unknown;
}

export type ChatActionType = 'goal' | 'profile' | 'none';

export interface ChatActionDetectionResult {
  isGoalAction: boolean;
  isProfileAction: boolean;
  actionType: ChatActionType;
}

const GOAL_TEXT_PATTERNS = [
  '目标已生效',
  '新目标已生效',
  '目标已成功同步',
  '新目标参数已生效',
  '已在系统成功设定',
  '已为你自动同步',
  '新阶段目标',
  '已更新训练目标',
  '已自动写入系统生效',
];

const PROFILE_TEXT_PATTERNS = [
  '已为您更新齿比',
  '已成功更新档案',
  '已更新你的档案',
  '已记录并更新',
  '硬件配置已成功更新',
];

export function detectChatAction(message: ChatMessageActionSource): ChatActionDetectionResult {
  const toolCallsStr =
    typeof message.tool_calls === 'string'
      ? message.tool_calls
      : JSON.stringify(message.tool_calls || []);

  const hasGoalToolCall = toolCallsStr.includes('set_training_goals');
  const hasProfileToolCall =
    toolCallsStr.includes('update_rider_profile') || toolCallsStr.includes('update_profile');

  const isAssistant = message.role === 'assistant';

  const hasGoalTextHeuristic =
    isAssistant && GOAL_TEXT_PATTERNS.some((pattern) => message.content.includes(pattern));

  const hasProfileTextHeuristic =
    isAssistant && PROFILE_TEXT_PATTERNS.some((pattern) => message.content.includes(pattern));

  const isGoalAction = hasGoalToolCall || hasGoalTextHeuristic;
  const isProfileAction = hasProfileToolCall || hasProfileTextHeuristic;

  let actionType: 'goal' | 'profile' | 'none' = 'none';
  if (isGoalAction) {
    actionType = 'goal';
  } else if (isProfileAction) {
    actionType = 'profile';
  }

  return {
    isGoalAction,
    isProfileAction,
    actionType,
  };
}

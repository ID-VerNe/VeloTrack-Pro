import { useState, useRef, useEffect, useCallback } from 'react';
import type { ChatMessage, SessionSummary } from '../types/rider';
import { getCoachSessions, getCoachMessages, deleteCoachSession, chatWithCoach } from '../services/aiCoach';
import { getRiderProfile } from '../services/riderService';

export const SUGGESTED_PROMPTS = [
  '测算大行P8在46T齿比下平路巡航20km/h的推荐踏频与档位',
  '结合近期实战双均速与负荷，评估下一阶段周里程与均速目标',
  '评估大齿比爬坡对右膝半月板的受力影响与降档节奏',
  '对比深圳湾与二沙岛等路线的巡航做功特征与心率恢复',
];

export const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: '### 战术与生理诊断就绪\n\n已装载 **大行 P8 (46T/11-28T)** 传动系统参数与近期骑行遥测数据库。\n\n可直接输入训练诉求进行 **齿比配速推演**、**心肺与踏频负荷诊断** 或 **自适应周目标调整**。',
};

export interface UseCoachChatOptions {
  initialPrompt?: string | null;
}

export function useCoachChat({ initialPrompt }: UseCoachChatOptions = {}) {
  const [sessionId, setSessionId] = useState<string>(() => {
    return localStorage.getItem('velotrack_coach_session_id') || 'coach_main';
  });

  const [messages, setMessages] = useState<ChatMessage[]>([DEFAULT_WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [riderInfo, setRiderInfo] = useState<{ weight: number; bike: string }>({ weight: 75, bike: '大行 P8' });

  // Floating Toast Notification State
  const [toast, setToast] = useState<{ title: string; desc: string; type: 'goal' | 'profile'; link?: string } | null>(null);

  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasTriggeredPromptRef = useRef(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessionMessages = useCallback(async (sid: string) => {
    try {
      const msgs = await getCoachMessages(sid);
      if (msgs && msgs.length > 0) {
        setMessages(msgs as unknown as ChatMessage[]);
      } else {
        setMessages([DEFAULT_WELCOME_MSG]);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setIsSessionLoaded(true);
    }
  }, []);

  const loadSessionsList = async () => {
    try {
      const list = await getCoachSessions();
      setSessions(list as unknown as SessionSummary[]);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  };

  const fetchRiderInfo = async () => {
    try {
      const profile = await getRiderProfile();
      setRiderInfo({
        weight: profile.weight_kg || 75,
        bike: profile.current_bike || '大行 P8',
      });
    } catch {}
  };

  useEffect(() => {
    localStorage.setItem('velotrack_coach_session_id', sessionId);
    setIsSessionLoaded(false);
    loadSessionMessages(sessionId);
    loadSessionsList();
    fetchRiderInfo();
  }, [sessionId, loadSessionMessages]);

  useEffect(() => {
    const handleProfileUpdated = () => fetchRiderInfo();
    window.addEventListener('profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('profile-updated', handleProfileUpdated);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSelectSession = (sid: string) => {
    setSessionId(sid);
  };

  const handleNewSession = () => {
    const newId = `session_${Date.now()}`;
    setSessionId(newId);
    setMessages([DEFAULT_WELCOME_MSG]);
  };

  const handleRequestDeleteSession = (sid = sessionId) => {
    setSessionToDelete(sid);
    setDeleteError(null);
  };

  const cancelDeleteSession = () => {
    setSessionToDelete(null);
    setDeleteError(null);
  };

  const handleConfirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    const sid = sessionToDelete;
    setDeleteError(null);
    try {
      await deleteCoachSession(sid);
      if (sid === sessionId) {
        setMessages([DEFAULT_WELCOME_MSG]);
      }
      await loadSessionsList();
      setSessionToDelete(null);
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.message || '删除会话失败');
    }
  };

  const handleSend = useCallback(async (textToSend?: string, appendUserMsg = true) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    if (appendUserMsg) {
      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: query.trim(),
      };
      setMessages((prev) => [...prev, userMsg]);
    }

    if (!textToSend) setInput('');
    setIsLoading(true);

    try {
      const result = await chatWithCoach(sessionId, query.trim());
      const reply = result.reply || '';
      if (!reply || reply.includes('未能获取回复') || reply.includes('异常')) {
        setMessages((prev) => [
          ...prev,
          {
            id: `error_${Date.now()}`,
            role: 'assistant',
            content: reply || '未能获取完整回复，请点击下方「重新生成」重试。',
            isError: true,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant_${Date.now()}`,
            role: 'assistant',
            content: reply,
            tool_calls: result.toolCalls,
          },
        ]);

        // Trigger prominent toast if goals or profile updated
        if (result.goalUpdated) {
          setToast({
            type: 'goal',
            title: '目标与周程指标已更新',
            desc: '已同步至系统目标看板，周目标与巡航基准已生效。',
            link: '/goals',
          });
          setTimeout(() => setToast(null), 5000);
        } else if (result.profileUpdated) {
          setToast({
            type: 'profile',
            title: '车手档案与硬件配置已更新',
            desc: '车辆参数与齿比配置已更新。',
          });
          setTimeout(() => setToast(null), 5000);
        }
      }
      await loadSessionsList();
      await fetchRiderInfo();
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: '连接分析服务时发生网络异常，请点击「重新生成」重试。',
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, sessionId]);

  useEffect(() => {
    if (initialPrompt && isSessionLoaded && !hasTriggeredPromptRef.current && !isLoading) {
      hasTriggeredPromptRef.current = true;
      handleSend(initialPrompt);
    }
  }, [initialPrompt, isSessionLoaded, isLoading, handleSend]);

  const handleRegenerate = async () => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg?.content) return;

    setMessages((prev) => {
      const next = [...prev];
      if (next.length > 1 && next[next.length - 1].role === 'assistant') {
        next.pop();
      }
      return next;
    });

    await handleSend(lastUserMsg.content, false);
  };

  return {
    sessionId,
    sessions,
    messages,
    input,
    setInput,
    isLoading,
    isSessionLoaded,
    riderInfo,
    toast,
    setToast,
    sessionToDelete,
    deleteError,
    messagesEndRef,
    handleSelectSession,
    handleNewSession,
    handleRequestDeleteSession,
    cancelDeleteSession,
    handleConfirmDeleteSession,
    handleSend,
    handleRegenerate,
  };
}

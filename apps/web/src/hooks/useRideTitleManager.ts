// apps/web/src/hooks/useRideTitleManager.ts
//
// 骑行详情标题管理 Hook
// 遵循单一职责（SRP）原则，集中托管标题本地 0ms 乐观更新、发件箱与远端持久化、AI 标题生成、8 秒撤销状态机。

import { useState, useCallback, useRef, useEffect } from 'react';
import { suggestRideTitle } from '../services/aiInsights';
import { outboxManager } from '../services/outboxManager';

export interface UseRideTitleManagerParams {
  id?: string;
  ride: any;
  setRide: React.Dispatch<React.SetStateAction<any>>;
}

export function useRideTitleManager({ id, ride, setRide }: UseRideTitleManagerParams) {
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false);
  const [suggestedTitle, setSuggestedTitle] = useState<string | null>(null);
  const [previousTitle, setPreviousTitle] = useState<string | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  const saveTitleToBackend = useCallback(
    async (newTitle: string) => {
      if (!id || !newTitle.trim()) return;
      const trimmed = newTitle.trim();
      setRide((prev: any) => (prev ? { ...prev, title: trimmed } : prev));
      try {
        await outboxManager.updateRideTitle(id, trimmed);
        const { updateRideTitle } = await import('../services/rideService');
        await updateRideTitle(id, trimmed);
      } catch (err) {
        console.error('Failed to update title', err);
      }
    },
    [id, setRide]
  );

  const triggerUndoCountdown = useCallback((oldTitle: string) => {
    setPreviousTitle(oldTitle);
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    undoTimeoutRef.current = setTimeout(() => {
      setPreviousTitle((prev) => (prev === oldTitle ? null : prev));
    }, 8000);
  }, []);

  const handleAIPolishTitle = useCallback(async () => {
    if (!id || !ride) return;
    setIsSuggestingTitle(true);
    try {
      const distKm = Number(((ride.distance_meters || 0) / 1000).toFixed(1));
      const result = await suggestRideTitle({
        start_time: ride.start_time,
        distance_km: distKm,
        avg_speed_kmh: ride.avg_speed_kmh || 0,
        total_ascent_meters: ride.total_ascent_meters || 0,
      });
      if (result.title && !result.title.includes('undefined')) {
        const polishedTitle = result.title.trim();
        const oldTitle = ride.title;
        triggerUndoCountdown(oldTitle);
        await saveTitleToBackend(polishedTitle);
        setSuggestedTitle(null);
      }
    } catch (err) {
      console.error('Failed to polish title with AI', err);
    } finally {
      setIsSuggestingTitle(false);
    }
  }, [id, ride, saveTitleToBackend, triggerUndoCountdown]);

  const handleApplySuggestedTitle = useCallback(async () => {
    if (!suggestedTitle || !ride) return;
    const oldTitle = ride.title;
    triggerUndoCountdown(oldTitle);
    await saveTitleToBackend(suggestedTitle);
    setSuggestedTitle(null);
  }, [suggestedTitle, ride, saveTitleToBackend, triggerUndoCountdown]);

  const handleCancelSuggestedTitle = useCallback(() => {
    setSuggestedTitle(null);
  }, []);

  const handleUndoTitle = useCallback(async () => {
    if (!previousTitle || !ride) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    await saveTitleToBackend(previousTitle);
    setPreviousTitle(null);
  }, [previousTitle, ride, saveTitleToBackend]);

  return {
    isSuggestingTitle,
    suggestedTitle,
    previousTitle,
    saveTitleToBackend,
    handleAIPolishTitle,
    handleApplySuggestedTitle,
    handleCancelSuggestedTitle,
    handleUndoTitle,
  };
}

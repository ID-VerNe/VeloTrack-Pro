// apps/web/src/hooks/usePeriodicReport.ts
//
// 周期骑行总结与数据分析状态机 Hook
// 遵循单一职责（SRP）原则，集中管理周期类型、时间轴游标、报表拉取、AI 洞察请求与会话级缓存。

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  computePeriodicSummary,
  generatePeriodInsight,
} from '../services/reportService';
import { formatPeriodTitle } from '../utils/dateUtils';

export type PeriodType = 'week' | 'month' | 'half_year' | 'year';

export interface UsePeriodicReportOptions {
  initialPeriodType?: PeriodType;
  initialTimestamp?: number;
}

export function usePeriodicReport({
  initialPeriodType = 'week',
  initialTimestamp = Date.now(),
}: UsePeriodicReportOptions = {}) {
  const [periodType, setPeriodType] = useState<PeriodType>(initialPeriodType);
  const [latestActiveTimestamp, setLatestActiveTimestamp] = useState<number>(initialTimestamp);
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(initialTimestamp);

  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // AI Insight State
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Detect latest active ride timestamp from database on initial mount
  useEffect(() => {
    fetch('/api/rides')
      .then((res) => res.json())
      .then((data) => {
        if (data.rides && data.rides.length > 0) {
          const maxTime = Math.max(...data.rides.map((r: any) => r.start_time || 0));
          if (maxTime > 0) {
            setLatestActiveTimestamp(maxTime);
            setCurrentTimestamp(maxTime);
          }
        }
      })
      .catch(console.error);
  }, []);

  const cacheKey = `velotrack_ai_insight_${periodType}_${currentTimestamp}`;

  const fetchReport = useCallback(async () => {
    setIsLoading(true);

    const cachedInsight = sessionStorage.getItem(cacheKey);
    if (cachedInsight) {
      setAiInsight(cachedInsight);
    } else {
      setAiInsight(null);
    }

    try {
      const data = await computePeriodicSummary(periodType, currentTimestamp);
      setReportData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [periodType, currentTimestamp, cacheKey]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handlePrevPeriod = useCallback(() => {
    const d = new Date(currentTimestamp);
    if (periodType === 'week') d.setDate(d.getDate() - 7);
    else if (periodType === 'month') d.setMonth(d.getMonth() - 1);
    else if (periodType === 'half_year') d.setMonth(d.getMonth() - 6);
    else d.setFullYear(d.getFullYear() - 1);
    setCurrentTimestamp(d.getTime());
  }, [currentTimestamp, periodType]);

  const handleNextPeriod = useCallback(() => {
    if (currentTimestamp >= latestActiveTimestamp) return;
    const d = new Date(currentTimestamp);
    if (periodType === 'week') d.setDate(d.getDate() + 7);
    else if (periodType === 'month') d.setMonth(d.getMonth() + 1);
    else if (periodType === 'half_year') d.setMonth(d.getMonth() + 6);
    else d.setFullYear(d.getFullYear() + 1);
    setCurrentTimestamp(Math.min(latestActiveTimestamp, d.getTime()));
  }, [currentTimestamp, latestActiveTimestamp, periodType]);

  const handleGenerateAiInsight = useCallback(async () => {
    if (!reportData?.summary || isAiLoading) return;
    setIsAiLoading(true);
    try {
      const insight = await generatePeriodInsight(
        periodType,
        reportData.summary,
        reportData.rides?.length || 0
      );
      if (insight) {
        setAiInsight(insight);
        sessionStorage.setItem(cacheKey, insight);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  }, [cacheKey, isAiLoading, periodType, reportData]);

  const handleResetToLatest = useCallback(() => {
    setCurrentTimestamp(latestActiveTimestamp);
  }, [latestActiveTimestamp]);

  const periodTitle = useMemo(() => {
    return formatPeriodTitle(
      periodType,
      reportData?.timeRange?.start || currentTimestamp,
      reportData?.timeRange?.end || currentTimestamp
    );
  }, [periodType, reportData, currentTimestamp]);

  const isNextDisabled = currentTimestamp >= latestActiveTimestamp;

  return {
    periodType,
    setPeriodType,
    currentTimestamp,
    latestActiveTimestamp,
    reportData,
    isLoading,
    aiInsight,
    isAiLoading,
    periodTitle,
    isNextDisabled,
    handlePrevPeriod,
    handleNextPeriod,
    handleResetToLatest,
    handleGenerateAiInsight,
    refetch: fetchReport,
  };
}

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw 
} from 'lucide-react';
import IconButton from '../components/common/IconButton';
import { formatPeriodTitle } from '../utils/dateUtils';

import PeriodSummaryCards from '../components/reports/PeriodSummaryCards';
import PeriodTimelineChart from '../components/reports/PeriodTimelineChart';
import PeriodInsightCard from '../components/reports/PeriodInsightCard';
import PeriodRidesTable from '../components/reports/PeriodRidesTable';
import {
  computePeriodicSummary,
  generatePeriodInsight,
} from '../services/reportService';

type PeriodType = 'week' | 'month' | 'half_year' | 'year';

export default function PeriodicReports() {
  const [periodType, setPeriodType] = useState<PeriodType>('week');
  const [latestActiveTimestamp, setLatestActiveTimestamp] = useState<number>(Date.now());
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(Date.now());

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

  const handlePrevPeriod = () => {
    const d = new Date(currentTimestamp);
    if (periodType === 'week') d.setDate(d.getDate() - 7);
    else if (periodType === 'month') d.setMonth(d.getMonth() - 1);
    else if (periodType === 'half_year') d.setMonth(d.getMonth() - 6);
    else d.setFullYear(d.getFullYear() - 1);
    setCurrentTimestamp(d.getTime());
  };

  const handleNextPeriod = () => {
    const d = new Date(currentTimestamp);
    if (periodType === 'week') d.setDate(d.getDate() + 7);
    else if (periodType === 'month') d.setMonth(d.getMonth() + 1);
    else if (periodType === 'half_year') d.setMonth(d.getMonth() + 6);
    else d.setFullYear(d.getFullYear() + 1);
    setCurrentTimestamp(d.getTime());
  };

  const handleGenerateAiInsight = async () => {
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
  };

  const periodTitle = useMemo(() => {
    return formatPeriodTitle(
      periodType,
      reportData?.start_time,
      reportData?.end_time
    );
  }, [periodType, reportData]);

  return (
    <div className="h-full w-full bg-[#F8FAFC] flex flex-col text-slate-900 overflow-hidden">
      <main className="flex-1 h-full flex flex-col bg-white overflow-hidden min-w-0">
        {/* Top Control Bar */}
        <header className="h-16 px-4 md:px-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div>
            <h1 className="text-base font-semibold text-slate-900 leading-tight">
              周期数据报告
            </h1>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              {periodTitle || '正在加载周期数据...'}
            </p>
          </div>

          {/* Period Segmented Control & Navigation */}
          <div className="flex items-center space-x-3 font-mono">
            <div className="border border-slate-200 p-0.5 rounded flex space-x-0.5 text-xs">
              {(
                [
                  { id: 'week', label: '周报' },
                  { id: 'month', label: '月报' },
                  { id: 'half_year', label: '半年报' },
                  { id: 'year', label: '年报' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPeriodType(tab.id)}
                  className={`px-3 py-1 rounded transition-colors cursor-pointer ${
                    periodType === tab.id
                      ? 'bg-brand-500 text-white font-medium shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Pagination Controls with Boundary Awareness */}
            {(() => {
              const isLatest = currentTimestamp >= latestActiveTimestamp;
              return (
                <div className="flex items-center space-x-1 border border-slate-200 rounded p-0.5 bg-white">
                  <IconButton label="上一周期" size="sm" onClick={handlePrevPeriod}>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </IconButton>
                  <button
                    onClick={() => setCurrentTimestamp(latestActiveTimestamp)}
                    className={`px-2 py-0.5 text-xs rounded transition-colors cursor-pointer ${
                      isLatest
                        ? 'bg-brand-500 text-white font-medium shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    title={isLatest ? '当前已是最新活跃周期' : '返回最新活跃周期'}
                  >
                    最新
                  </button>
                  <IconButton label="下一周期" size="sm" onClick={handleNextPeriod} disabled={isLatest}>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </IconButton>
                </div>
              );
            })()}
          </div>
        </header>

        {/* Scrollable Report Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 [scrollbar-width:none]">
          {isLoading ? (
            <div className="h-96 flex items-center justify-center text-slate-500 text-xs font-medium">
              <RefreshCw className="w-4 h-4 animate-spin mr-2 text-brand-500" />
              正在统计周期数据...
            </div>
          ) : (
            <>
              {/* 1. Summary Comparison Cards */}
              <PeriodSummaryCards summary={reportData?.summary} />

              {/* 2. Timeline Breakdown Chart */}
              <PeriodTimelineChart timeline={reportData?.timeline} />

              {/* 3. AI Periodic Review Box */}
              <PeriodInsightCard
                insight={aiInsight}
                isLoading={isAiLoading}
                onGenerate={handleGenerateAiInsight}
              />

              {/* 4. Rides in Period Table */}
              <PeriodRidesTable rides={reportData?.rides || []} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

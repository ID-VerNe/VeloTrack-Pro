import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart3, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw 
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { formatPeriodTitle } from '../utils/dateUtils';

import PeriodSummaryCards from '../components/reports/PeriodSummaryCards';
import PeriodTimelineChart from '../components/reports/PeriodTimelineChart';
import PeriodInsightCard from '../components/reports/PeriodInsightCard';
import PeriodRidesTable from '../components/reports/PeriodRidesTable';

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
      const res = await fetch(
        `/api/reports/summary?type=${periodType}&timestamp=${currentTimestamp}`
      );
      const data = await res.json();
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
      const res = await fetch('/api/reports/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period_type: periodType,
          summary: reportData.summary,
          rides_count: reportData.rides?.length || 0,
        }),
      });
      const data = await res.json();
      if (data.insight) {
        setAiInsight(data.insight);
        sessionStorage.setItem(cacheKey, data.insight);
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
    <div className="h-screen w-screen bg-[#F8FAFC] font-sans flex text-slate-900 overflow-hidden select-none">
      <Sidebar />

      <main className="flex-1 h-full flex flex-col bg-white overflow-hidden min-w-0">
        {/* Top Control Bar */}
        <header className="h-16 px-8 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white/90 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-xs">
              <BarChart3 className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 leading-tight">
                周期负荷与体能表现报告
              </h1>
              <p className="text-xs text-slate-400 font-medium">
                {periodTitle || '正在加载周期数据...'}
              </p>
            </div>
          </div>

          {/* Period Segmented Control & Navigation */}
          <div className="flex items-center space-x-3">
            <div className="bg-slate-100 p-1 rounded-xl flex space-x-1 text-xs font-bold">
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
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    periodType === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
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
                <div className="flex items-center space-x-1 border border-slate-200 rounded-xl p-1 bg-white shadow-2xs">
                  <button
                    onClick={handlePrevPeriod}
                    className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="上一周期"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentTimestamp(latestActiveTimestamp)}
                    className={`px-2 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      isLatest
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title={isLatest ? '当前已是最新活跃周期' : '返回最新活跃周期'}
                  >
                    最新
                  </button>
                  <button
                    onClick={handleNextPeriod}
                    disabled={isLatest}
                    className={`p-1 rounded-lg transition-colors ${
                      isLatest
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer'
                    }`}
                    title={isLatest ? '已达最新周期' : '下一周期'}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })()}
          </div>
        </header>

        {/* Scrollable Report Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 [scrollbar-width:none]">
          {isLoading ? (
            <div className="h-96 flex items-center justify-center text-slate-400 text-xs font-medium">
              <RefreshCw className="w-4 h-4 animate-spin mr-2 text-blue-600" />
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

import React from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw 
} from 'lucide-react';
import IconButton from '../components/common/IconButton';

import PeriodSummaryCards from '../components/reports/PeriodSummaryCards';
import PeriodTimelineChart from '../components/reports/PeriodTimelineChart';
import PeriodInsightCard from '../components/reports/PeriodInsightCard';
import PeriodRidesTable from '../components/reports/PeriodRidesTable';
import { usePeriodicReport } from '../hooks/usePeriodicReport';

export default function PeriodicReports() {
  const {
    periodType,
    setPeriodType,
    currentTimestamp,
    latestActiveTimestamp,
    reportData,
    isLoading,
    aiInsight,
    isAiLoading,
    periodTitle,
    handlePrevPeriod,
    handleNextPeriod,
    handleResetToLatest,
    handleGenerateAiInsight,
  } = usePeriodicReport();

  const isLatest = currentTimestamp >= latestActiveTimestamp;

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
            <div className="flex items-center space-x-1 border border-slate-200 rounded p-0.5 bg-white">
              <IconButton label="上一周期" size="sm" onClick={handlePrevPeriod}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </IconButton>
              <button
                onClick={handleResetToLatest}
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

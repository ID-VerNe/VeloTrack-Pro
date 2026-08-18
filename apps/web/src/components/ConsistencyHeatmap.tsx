import React, { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface Props {
  rides: any[];
}

export default function ConsistencyHeatmap({ rides }: Props) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [hoveredDay, setHoveredDay] = useState<{ dateStr: string; distanceKm: number; count: number } | null>(null);

  // Strictly compute full calendar year (Jan 1 -> Dec 31) from real rides data
  const { weeks, months, totalYearDistanceKm, activeDaysCount } = useMemo(() => {
    const dailyMap = new Map<string, { distanceMeters: number; count: number }>();
    let totalMeters = 0;

    rides.forEach((ride) => {
      if (!ride.start_time) return;
      const date = new Date(ride.start_time);
      if (date.getFullYear() !== selectedYear) return;

      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const existing = dailyMap.get(dateStr) || { distanceMeters: 0, count: 0 };
      const dist = ride.distance_meters || 0;
      dailyMap.set(dateStr, {
        distanceMeters: existing.distanceMeters + dist,
        count: existing.count + 1,
      });
      totalMeters += dist;
    });

    // Start from Monday of the week containing Jan 1st of selectedYear
    const jan1 = new Date(selectedYear, 0, 1);
    const dayOfWeek = jan1.getDay(); // 0 is Sunday, 1 is Monday...
    const dayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startDate = new Date(selectedYear, 0, 1 + dayOffset);

    const todayStr = new Date().toISOString().split('T')[0];
    const monthFirstWeekMap = new Map<number, number>();
    const weeksList: {
      dateStr: string;
      distanceKm: number;
      count: number;
      level: number;
      isFuture: boolean;
    }[][] = [];

    let activeDays = 0;
    const numWeeks = 53;

    for (let w = 0; w < numWeeks; w++) {
      const week: {
        dateStr: string;
        distanceKm: number;
        count: number;
        level: number;
        isFuture: boolean;
      }[] = [];

      for (let d = 0; d < 7; d++) {
        const cur = new Date(startDate);
        cur.setDate(startDate.getDate() + (w * 7 + d));
        const yyyy = cur.getFullYear();
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        const dd = String(cur.getDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;
        const monthNum = cur.getMonth();

        // Mark the first week this month appears in selected year
        if (cur.getFullYear() === selectedYear && !monthFirstWeekMap.has(monthNum)) {
          monthFirstWeekMap.set(monthNum, w);
        }

        const data = dailyMap.get(dateKey);
        const distMeters = data ? data.distanceMeters : 0;
        const count = data ? data.count : 0;
        const distanceKm = Number((distMeters / 1000).toFixed(1));
        const isFuture = dateKey > todayStr;

        let level = 0;
        if (distMeters > 0) {
          activeDays++;
          if (distMeters < 15000) level = 1;      // < 15 km
          else if (distMeters < 30000) level = 2; // 15 - 30 km
          else if (distMeters < 60000) level = 3; // 30 - 60 km
          else level = 4;                         // >= 60 km
        }

        week.push({ dateStr: dateKey, distanceKm, count, level, isFuture });
      }
      weeksList.push(week);
    }

    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    const monthList = monthNames.map((name, i) => ({
      name,
      weekIndex: monthFirstWeekMap.get(i) ?? Math.round((i / 12) * 53),
    }));

    return {
      weeks: weeksList,
      months: monthList,
      totalYearDistanceKm: (totalMeters / 1000).toFixed(1),
      activeDaysCount: activeDays,
    };
  }, [rides, selectedYear]);

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    // 修复：原先硬编码 add(2026)，跨年后日历仍残留过时年份选项。
    // 年份列表完全由"当前年份 + 数据中出现的年份"推导
    yearsSet.add(new Date().getFullYear());
    rides.forEach((r) => {
      if (r.start_time) {
        yearsSet.add(new Date(r.start_time).getFullYear());
      }
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [rides]);

  const getCellColor = (level: number, isFuture: boolean) => {
    if (level === 1) return 'bg-slate-300';
    if (level === 2) return 'bg-slate-500';
    if (level === 3) return 'bg-slate-700';
    if (level === 4) return 'bg-slate-900';
    if (isFuture) return 'bg-slate-100/50';
    return 'bg-slate-100 hover:bg-slate-200';
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200/80 p-6 select-none relative overflow-hidden space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">
            年度骑行打卡日历
          </h3>
          <p className="text-xs text-slate-600 font-mono mt-0.5 tabular-nums">
            {activeDaysCount} 天活跃骑行 • 全年累计 {totalYearDistanceKm} 公里
          </p>
        </div>

        {/* Interactive Year Selector Dropdown */}
        <div className="relative flex items-center bg-white px-2 py-1 rounded border border-slate-200 shrink-0 transition-colors">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="text-xs font-mono font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer pr-4 appearance-none"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}年
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-1.5" />
        </div>
      </div>

      {/* 53-Week Calendar Year Grid with Zero Scrollbars */}
      <div className="flex space-x-2 text-[10px] font-mono text-slate-400">
        {/* Day of week labels */}
        <div className="flex flex-col justify-between py-[1px] text-left font-normal w-3 shrink-0 leading-none select-none">
          <span>一</span>
          <span>三</span>
          <span>五</span>
          <span>日</span>
        </div>

        {/* 53 Columns Flex Container fitting exactly 100% width */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-stretch gap-[1.5px] w-full">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col justify-between gap-[1.5px] flex-1">
                {week.map((day, dIdx) => (
                  <div
                    key={dIdx}
                    onMouseEnter={() => setHoveredDay(day)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={`w-full aspect-square rounded-[1px] transition-colors cursor-pointer ${getCellColor(
                      day.level,
                      day.isFuture
                    )}`}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Month labels footer aligned precisely in Chinese */}
          <div className="relative h-4 text-[10px] font-mono text-slate-400 font-normal mt-2 select-none">
            {months.map((m, i) => {
              const leftPercent = (m.weekIndex / 53) * 100;
              return (
                <span
                  key={i}
                  className="absolute"
                  style={{ left: `${leftPercent}%` }}
                >
                  {m.name}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredDay && (
        <div className="absolute top-2 right-4 bg-slate-900 text-white text-xs font-mono px-2.5 py-1 rounded border border-slate-700 pointer-events-none z-20">
          {hoveredDay.dateStr}：
          {hoveredDay.distanceKm > 0
            ? `${hoveredDay.distanceKm} 公里 (${hoveredDay.count} 次骑行)`
            : '暂无骑行记录'}
        </div>
      )}
    </div>
  );
}

// apps/web/src/utils/heatmapCalendar.ts
//
// 骑行年度日历热力图网格推算纯函数
// 遵循单一职责（SRP）原则，解耦复杂日期推算算法与 UI 网格渲染。

export interface HeatmapDay {
  dateStr: string;
  distanceKm: number;
  count: number;
  level: number;
  isFuture: boolean;
}

export interface HeatmapMonthLabel {
  name: string;
  weekIndex: number;
}

export interface HeatmapCalendarResult {
  weeks: HeatmapDay[][];
  months: HeatmapMonthLabel[];
  totalYearDistanceKm: string;
  activeDaysCount: number;
}

/**
 * 依据真实骑行记录与选中年份，推算完整的 53 周周历网格与月份列索引
 */
export function computeHeatmapCalendar(rides: any[], selectedYear: number): HeatmapCalendarResult {
  const dailyMap = new Map<string, { distanceMeters: number; count: number }>();
  let totalMeters = 0;

  rides.forEach((ride) => {
    if (!ride || !ride.start_time) return;
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

  // 从包含选中年 1月1日的那一周的周一开始对齐
  const jan1 = new Date(selectedYear, 0, 1);
  const dayOfWeek = jan1.getDay(); // 0 是周日，1 是周一...
  const dayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startDate = new Date(selectedYear, 0, 1 + dayOffset);

  const todayStr = new Date().toISOString().split('T')[0];
  const monthFirstWeekMap = new Map<number, number>();
  const weeksList: HeatmapDay[][] = [];

  let activeDays = 0;
  const numWeeks = 53;

  for (let w = 0; w < numWeeks; w++) {
    const week: HeatmapDay[] = [];

    for (let d = 0; d < 7; d++) {
      const cur = new Date(startDate);
      cur.setDate(startDate.getDate() + (w * 7 + d));
      const yyyy = cur.getFullYear();
      const mm = String(cur.getMonth() + 1).padStart(2, '0');
      const dd = String(cur.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const monthNum = cur.getMonth();

      // 标记该月份在选中年份中首次出现的周次
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
  const monthList: HeatmapMonthLabel[] = monthNames.map((name, i) => ({
    name,
    weekIndex: monthFirstWeekMap.get(i) ?? Math.round((i / 12) * 53),
  }));

  return {
    weeks: weeksList,
    months: monthList,
    totalYearDistanceKm: (totalMeters / 1000).toFixed(1),
    activeDaysCount: activeDays,
  };
}

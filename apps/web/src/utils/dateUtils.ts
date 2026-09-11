/**
 * 获取指定时间戳所在自然周（周一 00:00:00 ~ 周日 23:59:59）的毫秒时间范围
 */
export function getNaturalWeekRange(baseTimestamp = Date.now()) {
  const date = new Date(baseTimestamp);
  const day = date.getDay(); // 0 是周日，1 是周一
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  sunday.setTime(sunday.getTime() - 1);

  return {
    start: monday.getTime(),
    end: sunday.getTime(),
  };
}

/**
 * 获取指定时间戳所在自然月（1日 00:00:00 ~ 月末 23:59:59）的毫秒时间范围
 */
export function getNaturalMonthRange(baseTimestamp = Date.now()) {
  const date = new Date(baseTimestamp);
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0).getTime();
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

  return { start, end };
}

/**
 * 根据周期类型和起止时间戳生成格式化的中文标题
 */
export type PeriodType = 'week' | 'month' | 'half_year' | 'year';

export interface PeriodBoundaries {
  currentStart: number;
  currentEnd: number;
  prevStart: number;
  prevEnd: number;
  breakdownCount: number;
  breakdownUnit: 'day' | 'week' | 'month';
}

/**
 * 计算周期起止时间戳及上一对比周期时间戳（周一为起点）
 */
export function getPeriodBoundaries(type: PeriodType, baseTimestamp = Date.now()): PeriodBoundaries {
  const date = new Date(baseTimestamp);

  let currentStart = 0;
  let currentEnd = 0;
  let prevStart = 0;
  let prevEnd = 0;
  let breakdownCount = 7;
  let breakdownUnit: 'day' | 'week' | 'month' = 'day';

  if (type === 'week') {
    const day = date.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(date);
    monday.setDate(date.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);

    currentStart = monday.getTime();
    currentEnd = currentStart + 7 * 24 * 3600 * 1000 - 1;
    prevStart = currentStart - 7 * 24 * 3600 * 1000;
    prevEnd = currentStart - 1;
    breakdownCount = 7;
    breakdownUnit = 'day';
  } else if (type === 'month') {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    currentStart = startOfMonth.getTime();
    currentEnd = endOfMonth.getTime();

    const startOfPrevMonth = new Date(date.getFullYear(), date.getMonth() - 1, 1, 0, 0, 0, 0);
    const endOfPrevMonth = new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999);
    prevStart = startOfPrevMonth.getTime();
    prevEnd = endOfPrevMonth.getTime();

    breakdownCount = 4;
    breakdownUnit = 'week';
  } else if (type === 'half_year') {
    const isFirstHalf = date.getMonth() < 6;
    const startHalf = new Date(date.getFullYear(), isFirstHalf ? 0 : 6, 1, 0, 0, 0, 0);
    const endHalf = new Date(date.getFullYear(), isFirstHalf ? 6 : 12, 0, 23, 59, 59, 999);
    currentStart = startHalf.getTime();
    currentEnd = endHalf.getTime();

    const startPrevHalf = new Date(isFirstHalf ? date.getFullYear() - 1 : date.getFullYear(), isFirstHalf ? 6 : 0, 1, 0, 0, 0, 0);
    const endPrevHalf = new Date(isFirstHalf ? date.getFullYear() - 1 : date.getFullYear(), isFirstHalf ? 12 : 6, 0, 23, 59, 59, 999);
    prevStart = startPrevHalf.getTime();
    prevEnd = endPrevHalf.getTime();

    breakdownCount = 6;
    breakdownUnit = 'month';
  } else {
    const startOfYear = new Date(date.getFullYear(), 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(date.getFullYear(), 11, 31, 23, 59, 59, 999);
    currentStart = startOfYear.getTime();
    currentEnd = endOfYear.getTime();

    const startPrevYear = new Date(date.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
    const endPrevYear = new Date(date.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    prevStart = startPrevYear.getTime();
    prevEnd = endPrevYear.getTime();

    breakdownCount = 12;
    breakdownUnit = 'month';
  }

  return { currentStart, currentEnd, prevStart, prevEnd, breakdownCount, breakdownUnit };
}

/**
 * 根据周期类型和起止时间戳生成格式化的中文标题
 */
export function formatPeriodTitle(
  periodType: PeriodType,
  startTime: number,
  endTime: number
): string {
  if (!startTime || !endTime) return '';
  const s = new Date(startTime);
  const e = new Date(endTime);

  if (periodType === 'week') {
    const weekNum = Math.ceil(
      ((s.getTime() - new Date(s.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
    );
    return `${s.getFullYear()}年 第${weekNum}周 (${s.getMonth() + 1}月${s.getDate()}日 - ${e.getMonth() + 1}月${e.getDate()}日)`;
  } else if (periodType === 'month') {
    return `${s.getFullYear()}年 ${s.getMonth() + 1}月度 训练汇总`;
  } else if (periodType === 'half_year') {
    return `${s.getFullYear()}年 ${s.getMonth() < 6 ? '上半年' : '下半年'} (1~6月 / 7~12月) 汇总`;
  } else {
    return `${s.getFullYear()} 全年度 训练总览`;
  }
}

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
export function formatPeriodTitle(
  periodType: 'week' | 'month' | 'half_year' | 'year',
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

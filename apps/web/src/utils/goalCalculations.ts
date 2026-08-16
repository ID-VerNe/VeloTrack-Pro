import { getNaturalWeekRange, getNaturalMonthRange } from './dateUtils';

export interface MilestoneAchievement {
  id: string;
  unlocked: boolean;
  title: string;
  date: string;
  icon: string;
  desc: string;
}

export interface ComputedGoalStats {
  totalDistanceKm: number;
  totalAscentM: number;
  bestAvgSpeedKmh: number;
  bestMovingAvgSpeedKmh: number;
  maxSprintSpeedKmh: number;
  longestRideKm: number;
  thisWeekDistanceKm: number;
  thisMonthDistanceKm: number;
  longestRideEvent: any | null;
  topSprintEvent: any | null;
  achievements: MilestoneAchievement[];
}

export function computeGoalStatsFromRides(rides: any[]): ComputedGoalStats {
  if (!rides || rides.length === 0) {
    return {
      totalDistanceKm: 0,
      totalAscentM: 0,
      bestAvgSpeedKmh: 0,
      bestMovingAvgSpeedKmh: 0,
      maxSprintSpeedKmh: 0,
      longestRideKm: 0,
      thisWeekDistanceKm: 0,
      thisMonthDistanceKm: 0,
      longestRideEvent: null,
      topSprintEvent: null,
      achievements: [],
    };
  }

  const totalDistMeters = rides.reduce((acc, r) => acc + (r.distance_meters || 0), 0);
  const totalDistKm = Number((totalDistMeters / 1000).toFixed(1));
  const totalAscentM = rides.reduce((acc, r) => acc + (r.total_ascent_meters || 0), 0);

  const bestMovingAvgSpeed = rides.reduce((acc, r) => {
    const mSec = r.moving_time_seconds || r.elapsed_time_seconds || 0;
    const spd = mSec > 0 ? ((r.distance_meters || 0) / 1000) / (mSec / 3600) : 0;
    return Math.max(acc, Number(spd.toFixed(1)));
  }, 0);

  const maxSprint = rides.reduce((acc, r) => Math.max(acc, r.max_speed_kmh || 0), 0);

  let longestKm = 0;
  let longestEvent: any = null;
  rides.forEach((r) => {
    const d = (r.distance_meters || 0) / 1000;
    if (d > longestKm) {
      longestKm = d;
      longestEvent = r;
    }
  });

  let topSprintVal = 0;
  let topSprintEvent: any = null;
  rides.forEach((r) => {
    if ((r.max_speed_kmh || 0) > topSprintVal) {
      topSprintVal = r.max_speed_kmh;
      topSprintEvent = r;
    }
  });

  const latestRideTime = Math.max(...rides.map((r) => r.start_time || 0));
  const refTime = latestRideTime > 0 ? latestRideTime : Date.now();

  const weekRange = getNaturalWeekRange(refTime);
  const weekRides = rides.filter(
    (r) => r.start_time >= weekRange.start && r.start_time <= weekRange.end
  );
  const thisWeekKm = Number(
    (weekRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0) / 1000).toFixed(1)
  );

  const monthRange = getNaturalMonthRange(refTime);
  const monthRides = rides.filter(
    (r) => r.start_time >= monthRange.start && r.start_time <= monthRange.end
  );
  const thisMonthKm = Number(
    (monthRides.reduce((acc, r) => acc + (r.distance_meters || 0), 0) / 1000).toFixed(1)
  );

  const achievements: MilestoneAchievement[] = [
    // 1. 40km 单次进阶
    longestKm >= 40.0 && longestEvent
      ? {
          id: 'ach_40km',
          unlocked: true,
          title: '首次单次破 40km 进阶',
          date: new Date(longestEvent.start_time).toLocaleDateString('zh-CN'),
          icon: '🚴',
          desc: `在「${longestEvent.title}」中真实完成 ${longestKm.toFixed(1)}km`,
        }
      : {
          id: 'ach_40km',
          unlocked: false,
          title: '单次 40km 进阶挑战',
          date: '进行中',
          icon: '🚴',
          desc: `当前最长单次记录: ${longestKm.toFixed(1)}km / 40.0km`,
        },
    // 2. 50km/h 极速冲刺
    maxSprint >= 50.0 && topSprintEvent
      ? {
          id: 'ach_sprint50',
          unlocked: true,
          title: '极速突破 50km/h 冲刺王',
          date: new Date(topSprintEvent.start_time).toLocaleDateString('zh-CN'),
          icon: '⚡',
          desc: `在「${topSprintEvent.title}」中冲出 ${maxSprint.toFixed(1)} km/h`,
        }
      : {
          id: 'ach_sprint50',
          unlocked: false,
          title: '50km/h 极速冲刺挑战',
          date: '进行中',
          icon: '⚡',
          desc: `当前最高冲刺极速: ${maxSprint.toFixed(1)} km/h / 50.0 km/h`,
        },
    // 3. 千米爬升
    totalAscentM >= 1000
      ? {
          id: 'ach_ascent1000',
          unlocked: true,
          title: '千米累计爬升征服者',
          date: '已达成',
          icon: '⛰️',
          desc: `累计征服爬升 ${totalAscentM} 米，成功翻越千米重力做功`,
        }
      : {
          id: 'ach_ascent1000',
          unlocked: false,
          title: '千米累计爬升挑战',
          date: '进行中',
          icon: '⛰️',
          desc: `当前累计爬升: ${totalAscentM}m / 1000m`,
        },
    // 4. 高踏频膝盖守护
    {
      id: 'ach_knee_health',
      unlocked: true,
      title: '高踏频膝盖守护使者',
      date: '持续保持',
      icon: '🛡️',
      desc: '坚持 85+ rpm 踏频，平路 46x18T/21T 巡航，有效降低膝关节剪切力矩',
    },
  ];

  return {
    totalDistanceKm: totalDistKm,
    totalAscentM,
    bestAvgSpeedKmh: bestMovingAvgSpeed,
    bestMovingAvgSpeedKmh: bestMovingAvgSpeed,
    maxSprintSpeedKmh: maxSprint,
    longestRideKm: longestKm,
    thisWeekDistanceKm: thisWeekKm,
    thisMonthDistanceKm: thisMonthKm,
    longestRideEvent: longestEvent,
    topSprintEvent,
    achievements,
  };
}

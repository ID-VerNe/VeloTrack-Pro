/**
 * VeloTrack AI Coach 工具 Schema 契约定义与本地执行引擎
 */

import {
  calculateGearCadenceSpeed,
  calculateClimbingPower,
  calculateHeartRateZones,
  calculateGoalTimeline,
} from '../../utils/cyclingPhysicsEngine';
import { analyzeSpeedDistribution } from '../../utils/speedDistribution';
import { calculateDualSpeeds } from '../../utils/cyclingCalculations';
import {
  updateRiderProfile,
  updateTrainingGoals,
  addGoalMilestone,
} from '../riderService';

export const COACH_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'calculate_cycling_kinematics',
      description: '【运动学与物理确定性计算引擎】计算齿比时速踏频对照表、爬坡克服重力做功与功率瓦特(W/kg)、Karvonen心率5区阈值、目标达成剩余周数时间预算',
      parameters: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['gear_cadence_speed', 'climbing_power', 'hr_zones', 'goal_timeline'],
            description: '计算类型：gear_cadence_speed(齿比踏频时速换算), climbing_power(爬升做功与克服重力功率), hr_zones(心率储备5区), goal_timeline(目标达成时间推演)',
          },
          chainring: { type: 'number', description: '前牙盘齿数，例如 46 或 53' },
          cogs: { type: 'array', items: { type: 'number' }, description: '后飞轮齿数列表，如 [11, 13, 15, 17, 19, 21, 24, 28]' },
          wheel_spec: { type: 'string', description: '轮径规格，如 "20x2.0" (大行P8/406), "20x1-1/8" (451), "700x25c"' },
          cadence_rpm: { type: 'number', description: '给定踩踏踏频(rpm)，计算各档位时速' },
          target_speed_kmh: { type: 'number', description: '给定目标稳态平路巡航时速(km/h)（必须使用开阔平路稳态巡航时速如 25-27km/h，严禁传入包含起步路口拉低后的停表均速），计算各档位所需踏频并找出85-95rpm黄金档位' },
          rider_weight_kg: { type: 'number', description: '车手体重(kg)' },
          bike_weight_kg: { type: 'number', description: '战车整备重量(kg)' },
          ascent_meters: { type: 'number', description: '累计爬升高度(米)' },
          moving_time_seconds: { type: 'number', description: '纯运动耗时(秒)' },
          ftp_watts: { type: 'number', description: '车手功能阈值功率(FTP)' },
          max_hr: { type: 'number', description: '最大心率(bpm)' },
          resting_hr: { type: 'number', description: '静息心率(bpm)' },
          current_hr: { type: 'number', description: '当前骑行平均心率(bpm)' },
          current_total_km: { type: 'number', description: '当前已完成累计里程(km)' },
          target_total_km: { type: 'number', description: '总目标里程(km)' },
          weekly_target_km: { type: 'number', description: '每周目标骑行里程(km)' },
          sessions_per_week: { type: 'number', description: '每周计划骑行频次，默认3' },
        },
        required: ['operation'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_rides_summary',
      description: '查询全部或指定城市的骑行统计摘要（总里程、综合停表均速、稳态巡航时速、速度损耗落差、总均速、运动时间、停顿时间、活动列表）',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名（例如 "广州"、"深圳" 或 "全部"）' },
        },
        required: ['city'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'set_training_goals',
      description: '当教练根据车手状态主动调整或制定量化训练目标时调用此工具自动同步到系统',
      parameters: {
        type: 'object',
        properties: {
          primary_goal: { type: 'string', description: '阶段训练核心主目标' },
          weekly_distance_km: { type: 'number', description: '每周目标骑行里程(km)' },
          target_avg_speed_kmh: { type: 'number', description: '目标平路巡航停表均速(km/h)' },
          monthly_distance_km: { type: 'number', description: '单月目标里程(km)' },
          coach_notes: { type: 'string', description: '教练给出的专属训练与踏频/齿比/膝盖保护指导说明' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_rider_profile',
      description: '当车手透露了体重、身高、车型、齿比、外胎、车重、改装件、伤病或目标时自动更新档案',
      parameters: {
        type: 'object',
        properties: {
          weight_kg: { type: 'number', description: '车手体重(kg)' },
          height_cm: { type: 'number', description: '车手身高(cm)' },
          current_bike: { type: 'string', description: '主力战车型号' },
          gear_ratio: { type: 'string', description: '齿比与变速配置' },
          tires: { type: 'string', description: '外胎规格与胎压' },
          bike_weight_kg: { type: 'number', description: '战车净重(kg)' },
          custom_specs: { type: 'object', description: '任意其他自定义硬件/配件/生理属性键值对' },
          injuries_notes: { type: 'string', description: '既往旧伤或身体不适备忘' },
          primary_goal: { type: 'string', description: '阶段训练目标' },
        },
      },
    },
  },
];

/**
 * 本地执行 AI 发起的工具调用
 */
export async function executeCoachTool(name: string, args: any): Promise<any> {
  if (name === 'calculate_cycling_kinematics') {
    const op = args.operation;
    if (op === 'gear_cadence_speed') {
      return calculateGearCadenceSpeed({
        chainring: args.chainring || 46,
        cogs: args.cogs || [11, 13, 15, 17, 19, 21, 24, 28],
        wheelSpec: args.wheel_spec || '20x2.0',
        cadenceRpm: args.cadence_rpm,
        targetSpeedKmh: args.target_speed_kmh,
      });
    } else if (op === 'climbing_power') {
      return calculateClimbingPower({
        riderWeightKg: args.rider_weight_kg || 75,
        bikeWeightKg: args.bike_weight_kg || 11.5,
        ascentMeters: args.ascent_meters || 0,
        movingTimeSeconds: args.moving_time_seconds || 3600,
        ftpWatts: args.ftp_watts || 165,
      });
    } else if (op === 'hr_zones') {
      return calculateHeartRateZones({
        maxHr: args.max_hr || 188,
        restingHr: args.resting_hr || 55,
        currentAvgHr: args.current_hr,
      });
    } else if (op === 'goal_timeline') {
      return calculateGoalTimeline({
        currentTotalKm: args.current_total_km || 0,
        targetTotalKm: args.target_total_km || 1000,
        weeklyTargetKm: args.weekly_target_km || 60,
        sessionsPerWeek: args.sessions_per_week || 3,
        targetAvgSpeedKmh: args.target_speed_kmh || 18,
      });
    }
    return { error: `Unsupported calculation operation: ${op}` };
  } else if (name === 'query_rides_summary') {
    const city = args.city || '全部';
    const allRes = await fetch('/api/rides');
    const allRides: any[] = allRes.ok ? (await allRes.json()).rides || [] : [];
    const filtered = allRides.filter((r: any) => {
      if (city === '全部') return true;
      const rCity = (r.start_lat || 0) > 22.8 ? '广州' : '深圳';
      return rCity.includes(city);
    });

    const totalDistMeters = filtered.reduce((acc: number, r: any) => acc + (r.distance_meters || 0), 0);
    const totalDistKm = Number((totalDistMeters / 1000).toFixed(1));
    const totalAscentM = filtered.reduce((acc: number, r: any) => acc + (r.total_ascent_meters || 0), 0);
    const totalMovingSec = filtered.reduce((acc: number, r: any) => acc + (r.moving_time_seconds || r.elapsed_time_seconds || 0), 0);
    const totalElapsedSec = filtered.reduce((acc: number, r: any) => acc + (r.elapsed_time_seconds || r.moving_time_seconds || 0), 0);

    const {
      movingAvgSpeedKmh: overallMovingAvgSpeed,
      elapsedAvgSpeedKmh: overallElapsedAvgSpeed,
      pausedTimeSeconds: totalPausedSec,
      movingRatioPct,
    } = calculateDualSpeeds(totalDistMeters, totalMovingSec, totalElapsedSec);

    const speedDist = analyzeSpeedDistribution(null, overallMovingAvgSpeed, 46, 15);

    return {
      city_queried: city,
      ride_count: filtered.length,
      total_distance_km: totalDistKm,
      moving_avg_speed_kmh: overallMovingAvgSpeed,
      cruising_avg_speed_kmh: speedDist.cruising_avg_speed_kmh,
      speed_loss_kmh: speedDist.speed_loss_kmh,
      elapsed_avg_speed_kmh: overallElapsedAvgSpeed,
      total_moving_time_hours: Number((totalMovingSec / 3600).toFixed(1)),
      total_paused_time_hours: Number((totalPausedSec / 3600).toFixed(1)),
      moving_ratio_pct: movingRatioPct,
      total_ascent_meters: totalAscentM,
      recent_rides: filtered.slice(0, 5).map((r: any) => {
        const mSec = r.moving_time_seconds || r.elapsed_time_seconds || 0;
        const eSec = r.elapsed_time_seconds || r.moving_time_seconds || 0;
        const dMeters = r.distance_meters || 0;
        const dual = calculateDualSpeeds(dMeters, mSec, eSec);
        return {
          title: r.title,
          date: new Date(r.start_time).toISOString().split('T')[0],
          distance_km: Number((dMeters / 1000).toFixed(1)),
          moving_time_mins: Math.round(dual.movingTimeSeconds / 60),
          paused_time_mins: Math.max(0, Math.round(dual.pausedTimeSeconds / 60)),
          moving_avg_speed_kmh: dual.movingAvgSpeedKmh,
          elapsed_avg_speed_kmh: dual.elapsedAvgSpeedKmh,
          ascent_m: r.total_ascent_meters,
        };
      }),
    };
  } else if (name === 'set_training_goals') {
    const updatedGoals = await updateTrainingGoals({
      weekly_distance_km: args.weekly_distance_km,
      target_avg_speed_kmh: args.target_avg_speed_kmh,
      monthly_distance_km: args.monthly_distance_km,
      coach_notes: args.coach_notes,
    });
    if (args.primary_goal) {
      await updateRiderProfile({ primary_goal: args.primary_goal });
    }
    // 记录阶段里程碑演进
    await addGoalMilestone({
      weekly_distance_km: args.weekly_distance_km || 60,
      target_avg_speed_kmh: args.target_avg_speed_kmh || 18,
      monthly_distance_km: args.monthly_distance_km,
      primary_goal: args.primary_goal,
      rationale: args.coach_notes ? args.coach_notes.slice(0, 60) : '教练根据近期巡航表现主动调优目标',
      source: 'coach',
    });
    return {
      success: true,
      message: '训练目标已在系统成功设定生效，并记录阶段里程碑演进轨迹',
      current_goals: updatedGoals,
    };
  } else if (name === 'update_rider_profile') {
    const updatedProfile = await updateRiderProfile(args);
    return {
      success: true,
      message: '车手档案与硬件配置已成功更新并保留既有配置',
      profile: updatedProfile,
    };
  }
  return { error: 'Unknown tool' };
}

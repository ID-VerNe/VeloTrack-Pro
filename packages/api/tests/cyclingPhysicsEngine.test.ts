/**
 * cyclingPhysicsEngine 纯工具模块单元测试
 * 覆盖：标准轮径周长表、齿比-踏频-时速换算、爬坡功率、心率区间、目标时间线推演
 * 断言值均为独立手算的理论结果。
 */
import { describe, it, expect } from 'vitest';
import {
  STANDARD_WHEEL_CIRCUMFERENCES,
  calculateGearCadenceSpeed,
  calculateClimbingPower,
  calculateHeartRateZones,
  calculateGoalTimeline,
} from '../src/utils/cyclingPhysicsEngine';

describe('STANDARD_WHEEL_CIRCUMFERENCES 标准轮径周长常量表', () => {
  it('包含全部 11 个常用轮径规格且数值合理', () => {
    expect(Object.keys(STANDARD_WHEEL_CIRCUMFERENCES).length).toBe(11);
    // 20 寸折叠车规格
    expect(STANDARD_WHEEL_CIRCUMFERENCES['20x2.0']).toBe(1.54);
    expect(STANDARD_WHEEL_CIRCUMFERENCES['20x1.75']).toBe(1.515);
    expect(STANDARD_WHEEL_CIRCUMFERENCES['20x1.5']).toBe(1.49);
    expect(STANDARD_WHEEL_CIRCUMFERENCES['20x1.35']).toBe(1.46);
    expect(STANDARD_WHEEL_CIRCUMFERENCES['20x1-1/8']).toBe(1.545);
    // 700c 公路车规格
    expect(STANDARD_WHEEL_CIRCUMFERENCES['700x23c']).toBe(2.097);
    expect(STANDARD_WHEEL_CIRCUMFERENCES['700x25c']).toBe(2.105);
    expect(STANDARD_WHEEL_CIRCUMFERENCES['700x28c']).toBe(2.136);
    expect(STANDARD_WHEEL_CIRCUMFERENCES['700x32c']).toBe(2.155);
    // 山地车规格
    expect(STANDARD_WHEEL_CIRCUMFERENCES['26x1.95']).toBe(2.055);
    expect(STANDARD_WHEEL_CIRCUMFERENCES['29x2.2']).toBe(2.298);
  });
});

describe('calculateGearCadenceSpeed 齿比-踏频-时速双向换算', () => {
  it('全部参数缺省时使用默认值：46T 牙盘、P8 标准飞轮、20x2.0 轮径', () => {
    const res = calculateGearCadenceSpeed({ chainring: 46 });
    expect(res.chainring).toBe(46);
    expect(res.wheel_spec).toBe('20x2.0');
    expect(res.wheel_circumference_m).toBe(1.54);
    expect(res.gear_table.length).toBe(8);
    expect(res.recommended_cruising_cog).toBeUndefined();

    // 首档 cog=11：46/11=4.18；齿比米数=4.18*1.54=6.44；齿比寸数≈4.18*(1.54/π*39.3701)=80.7
    const first = res.gear_table[0];
    expect(first.cog).toBe(11);
    expect(first.gear_ratio).toBe(4.18);
    expect(first.development_meters).toBe(6.44);
    expect(first.gear_inches).toBe(80.7);
    // 未给踏频/目标时速时速度与踏频为空
    expect(first.speed_at_cadence_kmh).toBeUndefined();
    expect(first.cadence_for_target_speed).toBeUndefined();
    expect(first.is_sweetspot_recommended).toBe(false);
    // 85~95 rpm 黄金踏频速度区间（cog=11）：min=85*4.18*1.54*0.06=32.8，max=95*...=36.7
    expect(first.sweetspot_speed_range_kmh.min).toBe(32.8);
    expect(first.sweetspot_speed_range_kmh.max).toBe(36.7);

    // 末档 cog=28：46/28=1.64；齿比米数=1.64*1.54=2.53；齿比寸数≈1.64*19.30=31.7
    const last = res.gear_table[7];
    expect(last.cog).toBe(28);
    expect(last.gear_ratio).toBe(1.64);
    expect(last.development_meters).toBe(2.53);
    expect(last.gear_inches).toBe(31.7); // 1.64 * 19.2991 = 31.65 → 31.7
  });

  it('给定踏频 90rpm 时，700x25c 轮径下 46/11 档理论时速为 47.5 km/h', () => {
    // speed = 90 * 4.18 * 2.105 * 0.06 = 47.514 → 47.5
    const res = calculateGearCadenceSpeed({
      chainring: 46,
      cogs: [11, 13],
      wheelSpec: '700x25c',
      cadenceRpm: 90,
    });
    expect(res.wheel_circumference_m).toBe(2.105);
    expect(res.gear_table[0].speed_at_cadence_kmh).toBe(47.5);
    // 46/13=3.54 → 90*3.54*2.105*0.06=40.239 → 40.2
    expect(res.gear_table[1].speed_at_cadence_kmh).toBe(40.2);
  });

  it('给定目标时速 30 km/h 时倒推各档所需踏频（取整）', () => {
    // cog=11: 30/(4.18*2.105*0.06)=56.825→57；cog=13: 30/(3.54*2.105*0.06)=67.099→67
    const res = calculateGearCadenceSpeed({
      chainring: 46,
      cogs: [11, 13],
      wheelSpec: '700x25c',
      targetSpeedKmh: 30,
    });
    expect(res.gear_table[0].cadence_for_target_speed).toBe(57);
    expect(res.gear_table[1].cadence_for_target_speed).toBe(67);
    // 57、67 均不在 82-96 rpm 黄金区间
    expect(res.gear_table[0].is_sweetspot_recommended).toBe(false);
    expect(res.gear_table[1].is_sweetspot_recommended).toBe(false);
    // 两者距 90 分别为 33 与 23，推荐 cog=13
    expect(res.recommended_cruising_cog).toBeDefined();
    expect(res.recommended_cruising_cog!.cog).toBe(13);
    expect(res.recommended_cruising_cog!.required_cadence_rpm).toBe(67);
  });

  it('推荐巡航档位：多个档位中选取所需踏频最接近 90 rpm 者，且命中黄金区间时推荐', () => {
    // cog=21: 18/(2.19*2.105*0.06)=65.08→65；cog=28: 18/(1.64*2.105*0.06)=86.90→87
    const res = calculateGearCadenceSpeed({
      chainring: 46,
      cogs: [21, 28],
      wheelSpec: '700x25c',
      targetSpeedKmh: 18,
    });
    expect(res.gear_table[0].cadence_for_target_speed).toBe(65);
    expect(res.gear_table[0].is_sweetspot_recommended).toBe(false);
    expect(res.gear_table[1].cadence_for_target_speed).toBe(87);
    expect(res.gear_table[1].is_sweetspot_recommended).toBe(true);
    // 87 距 90 更近 → 推荐 cog=28
    expect(res.recommended_cruising_cog!.cog).toBe(28);
    expect(res.recommended_cruising_cog!.required_cadence_rpm).toBe(87);
    expect(res.recommended_cruising_cog!.rationale).toContain('46/28T');
  });

  it('推荐巡航档位：当已有档位更接近 90rpm 时，后续档位不再覆盖推荐', () => {
    // cog=21 需 90rpm（距 90 最近），cog=28 需 121rpm → 保留首次选中的 cog=21
    const res = calculateGearCadenceSpeed({
      chainring: 46,
      cogs: [21, 28],
      wheelSpec: '700x25c',
      targetSpeedKmh: 25,
    });
    expect(res.gear_table[0].cadence_for_target_speed).toBe(90); // 25/0.276597=90.38→90
    expect(res.gear_table[0].is_sweetspot_recommended).toBe(true);
    expect(res.gear_table[1].cadence_for_target_speed).toBe(121); // 25/0.207132=120.70→121
    expect(res.recommended_cruising_cog!.cog).toBe(21);
    expect(res.recommended_cruising_cog!.required_cadence_rpm).toBe(90);
  });

  it('自定义轮径周长优先于查表；未知轮径规格回退 1.54 米', () => {
    const custom = calculateGearCadenceSpeed({
      chainring: 46,
      cogs: [11],
      wheelSpec: '700x25c',
      customCircumferenceM: 2.0,
      cadenceRpm: 60,
    });
    // 60 * 4.18 * 2.0 * 0.06 = 30.096 → 30.1
    expect(custom.wheel_circumference_m).toBe(2.0);
    expect(custom.gear_table[0].speed_at_cadence_kmh).toBe(30.1);

    const unknown = calculateGearCadenceSpeed({
      chainring: 46,
      cogs: [11],
      wheelSpec: '未知规格',
    });
    expect(unknown.wheel_circumference_m).toBe(1.54);
  });

  it('边界值：牙盘为 0 回退默认 46、飞轮空数组回退默认 8 档、踏频/目标时速为 0 视为未提供', () => {
    const res = calculateGearCadenceSpeed({
      chainring: 0,
      cogs: [],
      cadenceRpm: 0,
      targetSpeedKmh: 0,
    });
    expect(res.chainring).toBe(46);
    expect(res.gear_table.length).toBe(8);
    // 踏频 0 与目标时速 0 均走缺省分支 → 两项字段全 undefined
    for (const row of res.gear_table) {
      expect(row.speed_at_cadence_kmh).toBeUndefined();
      expect(row.cadence_for_target_speed).toBeUndefined();
    }
    expect(res.recommended_cruising_cog).toBeUndefined();
  });

  it('传入的飞轮列表会被升序排序', () => {
    const res = calculateGearCadenceSpeed({ chainring: 46, cogs: [28, 11, 15] });
    expect(res.gear_table.map((g) => g.cog)).toEqual([11, 15, 28]);
  });
});

describe('calculateClimbingPower 克服重力功率计算', () => {
  it('正常值：75kg 骑手+11.5kg 车，爬升 300m、用时 1800s 的重力功与功率', () => {
    const res = calculateClimbingPower({
      riderWeightKg: 75,
      bikeWeightKg: 11.5,
      ascentMeters: 300,
      movingTimeSeconds: 1800,
    });
    expect(res.total_system_mass_kg).toBe(86.5);
    expect(res.moving_time_minutes).toBe(30.0);
    // W = 86.5 * 9.80665 * 300 = 254482.57 → 254483 J
    expect(res.gravity_work_joules).toBe(254483);
    expect(res.gravity_work_kj).toBe(254.5);
    // P = 254483 / 1800 = 141.38 → 141.4 W
    expect(res.gravity_power_watts).toBeCloseTo(141.4, 1);
    // w/kg = 141.4 / 75 = 1.885 → 1.89
    expect(res.gravity_w_per_kg).toBe(1.89);
    // 超过 80W → 高强度爬坡；功率>=50 → 显著膝盖建议
    expect(res.intensity_rating).toBe('高强度爬坡 (Zone 4-5 阈值/无氧)');
    expect(res.knee_strain_advisory).toContain('提前 1-2 档');
  });

  it('FTP 占比：给定 FTP=200 时 141.4W 对应 71%', () => {
    const res = calculateClimbingPower({
      riderWeightKg: 75,
      ascentMeters: 300,
      movingTimeSeconds: 1800,
      ftpWatts: 200,
    });
    expect(res.ftp_percentage).toBe(71);
  });

  it('强度分级：80W 以上为高强度、45-80W 中度、20-45W 轻度、20W 以下微弱', () => {
    // 86.5kg、爬升 200m、用时 3600s：P=169655/3600=47.1W → 中度
    const moderate = calculateClimbingPower({
      riderWeightKg: 75,
      bikeWeightKg: 11.5,
      ascentMeters: 200,
      movingTimeSeconds: 3600,
    });
    expect(moderate.gravity_power_watts).toBeCloseTo(47.1, 1);
    expect(moderate.intensity_rating).toBe('中度爬坡阻力 (Zone 3 节奏区间)');

    // 86.5kg、爬升 100m、用时 3600s：P=84828/3600=23.6W → 轻度
    const light = calculateClimbingPower({
      riderWeightKg: 75,
      bikeWeightKg: 11.5,
      ascentMeters: 100,
      movingTimeSeconds: 3600,
    });
    expect(light.gravity_power_watts).toBeCloseTo(23.6, 1);
    expect(light.intensity_rating).toBe('轻度起伏做功 (Zone 2 有氧耐力)');

    // 86.5kg、爬升 100m、用时 7200s：P=84828/7200=11.8W → 微弱
    const mild = calculateClimbingPower({
      riderWeightKg: 75,
      bikeWeightKg: 11.5,
      ascentMeters: 100,
      movingTimeSeconds: 7200,
    });
    expect(mild.gravity_power_watts).toBeCloseTo(11.8, 1);
    expect(mild.intensity_rating).toBe('微弱起伏负荷 (Zone 1-2)');
  });

  it('膝盖建议分支：功率>=50 或爬升>200m 显著；爬升>80m 起伏；其余平缓', () => {
    // 功率 23.6W 但爬升 250m>200 → 显著
    const strong = calculateClimbingPower({
      riderWeightKg: 75,
      bikeWeightKg: 11.5,
      ascentMeters: 250,
      movingTimeSeconds: 9000,
    });
    expect(strong.gravity_power_watts).toBeCloseTo(23.6, 1);
    expect(strong.knee_strain_advisory).toContain('提前 1-2 档');

    // 功率 9.4W 且爬升 100m>80 → 起伏路段建议
    const rolling = calculateClimbingPower({
      riderWeightKg: 75,
      bikeWeightKg: 11.5,
      ascentMeters: 100,
      movingTimeSeconds: 9000,
    });
    expect(rolling.gravity_power_watts).toBeCloseTo(9.4, 1);
    expect(rolling.knee_strain_advisory).toContain('起伏路段注意坡底提前减档');

    // 功率 4.7W 且爬升 50m≤80 → 平缓建议
    const flat = calculateClimbingPower({
      riderWeightKg: 75,
      bikeWeightKg: 11.5,
      ascentMeters: 50,
      movingTimeSeconds: 9000,
    });
    expect(flat.gravity_power_watts).toBeCloseTo(4.7, 1);
    expect(flat.knee_strain_advisory).toBe('爬升坡度平缓，维持 85+ rpm 顺畅踩踏即可。');
  });

  it('边界与默认值：体重/车重/爬升/时间为 0 时回退默认，FTP 缺失则占比为空', () => {
    const res = calculateClimbingPower({
      riderWeightKg: 0,
      bikeWeightKg: 0,
      ascentMeters: 0,
      movingTimeSeconds: 0,
      ftpWatts: 0,
    });
    expect(res.total_system_mass_kg).toBe(86.5); // 75 + 11.5
    expect(res.ascent_meters).toBe(0);
    expect(res.moving_time_minutes).toBe(0.0); // 1/60=0.0
    expect(res.gravity_work_joules).toBe(0);
    expect(res.gravity_work_kj).toBe(0.0);
    expect(res.gravity_power_watts).toBe(0.0);
    expect(res.gravity_w_per_kg).toBe(0.0);
    expect(res.ftp_percentage).toBeUndefined();
    expect(res.intensity_rating).toBe('微弱起伏负荷 (Zone 1-2)');
  });

  it('负值/无效时间会钳制到 1 秒；负 FTP 视为无效', () => {
    // 用时 -100 → Math.max(1, -100)=1 秒；爬升 -50 → Number(-50)||0=-50
    const res = calculateClimbingPower({
      riderWeightKg: 60,
      bikeWeightKg: 10,
      ascentMeters: -50,
      movingTimeSeconds: -100,
      ftpWatts: -200,
    });
    expect(res.total_system_mass_kg).toBe(70.0);
    expect(res.moving_time_minutes).toBe(0.0);
    expect(res.ftp_percentage).toBeUndefined();
  });

  it('w/kg 与正常车重组合：70kg 系统 100m/600s 的高强度输出', () => {
    const res = calculateClimbingPower({
      riderWeightKg: 60,
      bikeWeightKg: 10,
      ascentMeters: 100,
      movingTimeSeconds: 600,
    });
    // W = 70*9.80665*100 = 68646.55 → 68647 J；P = 68647/600 = 114.41 → 114.4 W
    expect(res.gravity_work_joules).toBe(68647);
    expect(res.gravity_power_watts).toBeCloseTo(114.4, 1);
    expect(res.gravity_w_per_kg).toBe(1.91); // 114.4/60=1.9067 → 1.91
    expect(res.intensity_rating).toBe('高强度爬坡 (Zone 4-5 阈值/无氧)');
    expect(res.knee_strain_advisory).toContain('提前 1-2 档');
  });
});

describe('calculateHeartRateZones Karvonen 储备心率区间', () => {
  it('默认值：maxHr=188、restingHr=55 时各区间边界正确', () => {
    const res = calculateHeartRateZones({ maxHr: 188, restingHr: 55 });
    expect(res.max_hr).toBe(188);
    expect(res.resting_hr).toBe(55);
    expect(res.heart_rate_reserve).toBe(133);
    expect(res.current_hr_assessment).toBeUndefined();

    const z = res.zones;
    // 55+133*0.5=121.5→122；55+133*0.6=134.8→135
    expect(z.zone1_recovery.min).toBe(122);
    expect(z.zone1_recovery.max).toBe(135);
    expect(z.zone2_endurance.min).toBe(136);
    expect(z.zone2_endurance.max).toBe(148); // 55+133*0.7=148.1→148
    expect(z.zone3_tempo.min).toBe(149);
    expect(z.zone3_tempo.max).toBe(161); // 55+133*0.8=161.4→161
    expect(z.zone4_threshold.min).toBe(162);
    expect(z.zone4_threshold.max).toBe(175); // 55+133*0.9=174.7→175
    expect(z.zone5_anaerobic.min).toBe(176);
    expect(z.zone5_anaerobic.max).toBe(188);
    // 区间标签校验
    expect(z.zone2_endurance.label).toBe('Zone 2 黄金有氧耐力');
    expect(z.zone5_anaerobic.label).toBe('Zone 5 无氧冲刺');
    expect(z.zone5_anaerobic.description).toContain('严控持续时间');
  });

  it('心率评估覆盖全部区间：Z5/Z4/Z3/Z2/Z1/低于 Z1', () => {
    const make = (hr: number) =>
      calculateHeartRateZones({ maxHr: 188, restingHr: 55, currentAvgHr: hr });

    expect(make(180).current_hr_assessment!.current_zone).toBe('Zone 5 无氧极限');
    expect(make(176).current_hr_assessment!.current_zone).toBe('Zone 5 无氧极限'); // 恰好 Z5 下界
    expect(make(175).current_hr_assessment!.current_zone).toBe('Zone 4 乳酸阈值'); // 恰好 Z5 下界-1
    expect(make(162).current_hr_assessment!.current_zone).toBe('Zone 4 乳酸阈值');
    expect(make(149).current_hr_assessment!.current_zone).toBe('Zone 3 节奏巡航');
    expect(make(148).current_hr_assessment!.current_zone).toBe('Zone 2 黄金有氧耐力');
    expect(make(136).current_hr_assessment!.current_zone).toBe('Zone 2 黄金有氧耐力');
    expect(make(130).current_hr_assessment!.current_zone).toBe('Zone 1 积极恢复');
    expect(make(121).current_hr_assessment!.current_zone).toBe('低于 Zone 1 (静息/微活动)');
    // hr 取整：130.6 → 131
    expect(make(130.6).current_hr_assessment!.hr).toBe(131);
  });

  it('另一组配置 maxHr=180、restingHr=50 的区间边界', () => {
    const res = calculateHeartRateZones({ maxHr: 180, restingHr: 50 });
    expect(res.heart_rate_reserve).toBe(130);
    const z = res.zones;
    expect(z.zone1_recovery.min).toBe(115); // 50+65=115
    expect(z.zone1_recovery.max).toBe(128); // 50+78=128
    expect(z.zone2_endurance.min).toBe(129);
    expect(z.zone2_endurance.max).toBe(141); // 50+91=141
    expect(z.zone3_tempo.min).toBe(142);
    expect(z.zone3_tempo.max).toBe(154); // 50+104=154
    expect(z.zone4_threshold.min).toBe(155);
    expect(z.zone4_threshold.max).toBe(167); // 50+117=167
    expect(z.zone5_anaerobic.min).toBe(168);
    expect(z.zone5_anaerobic.max).toBe(180);
  });

  it('边界值：maxHr/restingHr 为 0 或无效时回退默认 188/55', () => {
    const res = calculateHeartRateZones({ maxHr: 0, restingHr: 0 } as never);
    expect(res.max_hr).toBe(188);
    expect(res.resting_hr).toBe(55);
    const res2 = calculateHeartRateZones({ maxHr: Number('abc'), restingHr: Number('xyz') } as never);
    expect(res2.max_hr).toBe(188);
    expect(res2.resting_hr).toBe(55);
  });
});

describe('calculateGoalTimeline 周期目标缺口与时间预算推演', () => {
  it('正常值：已骑 500km、目标 1000km、周目标 100km、每周 4 次、均速 20km/h', () => {
    const res = calculateGoalTimeline({
      currentTotalKm: 500,
      targetTotalKm: 1000,
      weeklyTargetKm: 100,
      sessionsPerWeek: 4,
      targetAvgSpeedKmh: 20,
    });
    expect(res.current_total_km).toBe(500);
    expect(res.target_total_km).toBe(1000);
    expect(res.remaining_km).toBe(500);
    expect(res.completion_pct).toBe(50.0);
    expect(res.estimated_weeks_remaining).toBe(5.0); // 500/100
    expect(res.sessions_per_week).toBe(4);
    expect(res.km_per_session).toBe(25.0); // 100/4
    expect(res.estimated_hours_per_session).toBe(1.25); // 25/20
    expect(res.estimated_minutes_per_session).toBe(75);
  });

  it('已完成里程超过目标时剩余量为 0，完成度可超 100%', () => {
    const res = calculateGoalTimeline({
      currentTotalKm: 1200,
      targetTotalKm: 1000,
      weeklyTargetKm: 100,
    });
    expect(res.remaining_km).toBe(0);
    expect(res.completion_pct).toBe(120.0);
    expect(res.estimated_weeks_remaining).toBe(0.0);
  });

  it('全部缺省时使用默认值：目标 1000km、周目标 60km、每周 3 次、均速 18km/h', () => {
    const res = calculateGoalTimeline({
      currentTotalKm: 0,
      targetTotalKm: 0,
      weeklyTargetKm: 0,
      sessionsPerWeek: 0,
      targetAvgSpeedKmh: 0,
    });
    expect(res.current_total_km).toBe(0);
    expect(res.target_total_km).toBe(1000);
    expect(res.remaining_km).toBe(1000);
    expect(res.completion_pct).toBe(0.0);
    expect(res.weekly_target_km).toBe(60);
    expect(res.sessions_per_week).toBe(3);
    expect(res.km_per_session).toBe(20.0); // 60/3
    // 20/18=1.1111 → 1.11 小时 → 67 分钟
    expect(res.estimated_hours_per_session).toBe(1.11);
    expect(res.estimated_minutes_per_session).toBe(67);
    expect(res.estimated_weeks_remaining).toBe(16.7); // 1000/60=16.667→16.7
  });

  it('负周目标会被钳制为 1，负均速导致每场时长为空', () => {
    const res = calculateGoalTimeline({
      currentTotalKm: 10,
      targetTotalKm: 100,
      weeklyTargetKm: -5,
      targetAvgSpeedKmh: -5,
    });
    expect(res.weekly_target_km).toBe(1); // Math.max(1, -5)=1
    expect(res.km_per_session).toBe(0.3); // 1/3=0.333→0.3
    expect(res.estimated_weeks_remaining).toBe(90.0); // 90/1
    // 负均速不满足 speed>0 → 每场时长为空
    expect(res.estimated_hours_per_session).toBeUndefined();
    expect(res.estimated_minutes_per_session).toBeUndefined();
  });

  it('目标与当前相等时剩余 0、完成度 100%、周数为 0', () => {
    const res = calculateGoalTimeline({
      currentTotalKm: 800,
      targetTotalKm: 800,
      weeklyTargetKm: 50,
      sessionsPerWeek: 2,
    });
    expect(res.remaining_km).toBe(0);
    expect(res.completion_pct).toBe(100.0);
    expect(res.estimated_weeks_remaining).toBe(0.0);
    // 50/2=25km/次，25/18=1.3889→1.39 小时→83 分钟
    expect(res.km_per_session).toBe(25.0);
    expect(res.estimated_hours_per_session).toBe(1.39);
    expect(res.estimated_minutes_per_session).toBe(83);
  });
});

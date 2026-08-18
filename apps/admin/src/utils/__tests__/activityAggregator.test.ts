import { describe, it, expect } from 'vitest';
import polyline from '@mapbox/polyline';
import { aggregateActivityData, type TCXPoint } from '../activityAggregator';
import { getHaversineDistanceMeters } from '../geoCalculations';

describe('aggregateActivityData 基础校验', () => {
  it('points 为空数组时抛出错误', () => {
    expect(() => aggregateActivityData({ title: '测试', points: [] })).toThrow(
      'No trackpoints found in activity file.'
    );
  });

  it('points 为 undefined 时抛出错误', () => {
    expect(() =>
      aggregateActivityData({ title: '测试', points: undefined as unknown as TCXPoint[] })
    ).toThrow('No trackpoints found in activity file.');
  });

  it('乱序点按时间升序重排，id 取 start_time 字符串', () => {
    const points: TCXPoint[] = [
      { time: 3000, lat: 1, lng: 1 },
      { time: 1000, lat: 1, lng: 1 },
      { time: 2000, lat: 1, lng: 1 },
    ];
    const r = aggregateActivityData({ title: '晨间骑行', points });
    expect(r.start_time).toBe(1000);
    expect(r.end_time).toBe(3000);
    expect(r.points.map((p) => p.time)).toEqual([1000, 2000, 3000]);
    expect(r.id).toBe('1000');
    expect(r.title).toBe('晨间骑行');
  });
});

describe('aggregateActivityData elapsed_time 计算', () => {
  it('未提供 explicit 时由时间范围计算（毫秒差转秒）', () => {
    const points: TCXPoint[] = [{ time: 0 }, { time: 3600000 }];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.elapsed_time_seconds).toBe(3600);
  });

  it('explicitElapsedTimeSeconds 覆盖自动计算值', () => {
    const points: TCXPoint[] = [{ time: 0 }, { time: 3600000 }];
    const r = aggregateActivityData({ title: 't', points, explicitElapsedTimeSeconds: 7200 });
    expect(r.elapsed_time_seconds).toBe(7200);
  });

  it('explicitElapsedTimeSeconds 非整数时会取整', () => {
    const points: TCXPoint[] = [{ time: 0 }];
    const r = aggregateActivityData({ title: 't', points, explicitElapsedTimeSeconds: 7200.6 });
    expect(r.elapsed_time_seconds).toBe(7201);
  });

  it('时间范围为 0 且无 explicit 时兜底为 1 秒', () => {
    const points: TCXPoint[] = [{ time: 123 }];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.elapsed_time_seconds).toBe(1);
  });
});

describe('aggregateActivityData distance 计算优先级', () => {
  it('优先使用 Trackpoint 自带 distance 的最大值', () => {
    const points: TCXPoint[] = [
      { time: 0, distance: 100 },
      { time: 1000, distance: 500 },
    ];
    const r = aggregateActivityData({
      title: 't',
      points,
      explicitDistanceMeters: 999,
      explicitElapsedTimeSeconds: 60,
    });
    expect(r.distance_meters).toBe(500);
  });

  it('无 Trackpoint distance 时使用 explicitDistanceMeters（取整）', () => {
    const points: TCXPoint[] = [{ time: 0 }];
    const r = aggregateActivityData({
      title: 't',
      points,
      explicitDistanceMeters: 12000.6,
      explicitElapsedTimeSeconds: 60,
    });
    expect(r.distance_meters).toBe(12001);
  });

  it('两者都为空时用 Haversine 累计相邻点距离', () => {
    // 赤道上每 0.001° 经度 ≈ 111.195m，两段合计 ≈ 222.39 → 取整 222
    const points: TCXPoint[] = [
      { time: 0, lat: 0, lng: 0 },
      { time: 10000, lat: 0, lng: 0.001 },
      { time: 20000, lat: 0, lng: 0.002 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    const expected = getHaversineDistanceMeters(0, 0, 0, 0.001) * 2;
    expect(r.distance_meters).toBe(Math.round(expected));
  });
});

describe('aggregateActivityData calories 透传', () => {
  it('explicitCalories 原样返回', () => {
    const points: TCXPoint[] = [{ time: 0 }];
    const r = aggregateActivityData({ title: 't', points, explicitCalories: 523 });
    expect(r.calories).toBe(523);
  });
});

describe('aggregateActivityData 派生速度', () => {
  it('缺失 speed、dt<30s 且推导速度 <90km/h 时填充派生速度', () => {
    // 相邻两点约 55.6m、间隔 10s → 速度约 20km/h
    const points: TCXPoint[] = [
      { time: 0, lat: 30, lng: 120 },
      { time: 10000, lat: 30.0005, lng: 120 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    const derived = r.points[1].speed!;
    // (距离 / dt) * 3.6 → 约 20km/h
    expect(derived).toBeCloseTo(getHaversineDistanceMeters(30, 120, 30.0005, 120) / 10 * 3.6, 0);
    expect(derived).toBeGreaterThan(15);
    expect(derived).toBeLessThan(25);
  });

  it('推导速度 >=90km/h 时不填充（异常跳变点）', () => {
    // 相邻两点约 1112m、间隔 1s → 速度约 4003km/h
    const points: TCXPoint[] = [
      { time: 0, lat: 30, lng: 120 },
      { time: 1000, lat: 30.01, lng: 120 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.points[1].speed).toBeUndefined();
  });

  it('dt>=30s 时不推导速度', () => {
    // 相邻两点约 111.2m、间隔 40s → 速度约 10km/h 但 dt 不满足 <30
    const points: TCXPoint[] = [
      { time: 0, lat: 30, lng: 120 },
      { time: 40000, lat: 30.001, lng: 120 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.points[1].speed).toBeUndefined();
  });

  it('已有显式 speed 时不覆盖', () => {
    const points: TCXPoint[] = [
      { time: 0, lat: 30, lng: 120 },
      { time: 10000, lat: 30.0005, lng: 120, speed: 12 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.points[1].speed).toBe(12);
  });
});

describe('aggregateActivityData 爬升/下降与最大海拔', () => {
  it('默认（cumulativeClimb=0）时按相邻点海拔差累计爬升/下降', () => {
    const points: TCXPoint[] = [
      { time: 0, altitude: 100 },
      { time: 10000, altitude: 120 },
      { time: 20000, altitude: 110 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.total_ascent_meters).toBe(20);
    expect(r.total_descent_meters).toBe(10);
    expect(r.max_altitude_meters).toBe(120);
  });

  it('传入 cumulativeClimb/cumulativeDecrease 时不再从点累计', () => {
    const points: TCXPoint[] = [
      { time: 0, altitude: 100 },
      { time: 10000, altitude: 120 },
    ];
    const r = aggregateActivityData({
      title: 't',
      points,
      cumulativeClimbMeters: 300,
      cumulativeDecreaseMeters: 50,
    });
    expect(r.total_ascent_meters).toBe(300);
    expect(r.total_descent_meters).toBe(50);
    expect(r.max_altitude_meters).toBe(120);
  });

  it('无海拔数据时 max_altitude 为 0（而非 -Infinity）', () => {
    const points: TCXPoint[] = [{ time: 0 }, { time: 1000 }];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.max_altitude_meters).toBe(0);
  });

  it('相邻点海拔相等（差值=0）时不累计爬升也不累计下降', () => {
    const points: TCXPoint[] = [
      { time: 0, altitude: 100 },
      { time: 1000, altitude: 100 },
      { time: 2000, altitude: 100 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.total_ascent_meters).toBe(0);
    expect(r.total_descent_meters).toBe(0);
    expect(r.max_altitude_meters).toBe(100);
  });
});

describe('aggregateActivityData 心率与心率区间', () => {
  it('默认 userMaxHr=188 时各心率区间秒数正确累计', () => {
    // 区间边界（188）：z1<112.8、z2<131.6、z3<150.4、z4<169.2、z5>=169.2
    const points: TCXPoint[] = [
      { time: 0, hr: 100 },     // 0.532 → z1，dt=0 → 计入 1 秒
      { time: 1000, hr: 120 },  // 0.638 → z2，dt=1 → 计入 1 秒
      { time: 2000, hr: 140 },  // 0.745 → z3
      { time: 3000, hr: 160 },  // 0.851 → z4
      { time: 4000, hr: 180 },  // 0.957 → z5
    ];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.hr_z1_seconds).toBe(1);
    expect(r.hr_z2_seconds).toBe(1);
    expect(r.hr_z3_seconds).toBe(1);
    expect(r.hr_z4_seconds).toBe(1);
    expect(r.hr_z5_seconds).toBe(1);
    expect(r.max_heart_rate).toBe(180);
    expect(r.avg_heart_rate).toBe(140); // (100+120+140+160+180)/5
  });

  it('自定义 userMaxHr 参与心率区间划分', () => {
    const points: TCXPoint[] = [
      { time: 0, hr: 100 },   // 100/200 = 0.5 → z1
      { time: 1000, hr: 130 }, // 130/200 = 0.65 → z2
    ];
    const r = aggregateActivityData({ title: 't', points, userMaxHr: 200 });
    expect(r.hr_z1_seconds).toBe(1);
    expect(r.hr_z2_seconds).toBe(1);
    expect(r.hr_z3_seconds).toBe(0);
  });

  it('后续心率低于当前最大心率时不更新 max_heart_rate', () => {
    const points: TCXPoint[] = [
      { time: 0, hr: 180 },
      { time: 1000, hr: 120 },
      { time: 2000, hr: 150 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.max_heart_rate).toBe(180);
    expect(r.avg_heart_rate).toBe(150); // (180+120+150)/3
  });

  it('无心率数据时 avg/max 心率为 0', () => {
    const points: TCXPoint[] = [{ time: 0 }, { time: 1000 }];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.avg_heart_rate).toBe(0);
    expect(r.max_heart_rate).toBe(0);
  });
});

describe('aggregateActivityData moving_time 累计', () => {
  it('仅 speed>=1.5 且 dt<60s 计入；无 speed 且 dt<60s 也计入', () => {
    const points: TCXPoint[] = [
      { time: 0, speed: 20 },       // dt=0 不计
      { time: 10000, speed: 20 },   // dt=10 >=1.5 → +10
      { time: 20000, speed: 1.0 },  // dt=10 但 <1.5 → 不计
      { time: 90000, speed: 20 },   // dt=70s >=60 → 不计
      { time: 100000 },             // dt=10 无 speed → +10
    ];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.moving_time_seconds).toBe(20);
  });

  it('moving_time 全为 0 时兜底为 elapsed_time_seconds', () => {
    const points: TCXPoint[] = [
      { time: 0, speed: 0.5 },
      { time: 10000, speed: 0.5 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    // 两段 speed<1.5 不计 → moving_time=0；elapsed=10 → 兜底 10
    expect(r.moving_time_seconds).toBe(10);
  });
});

describe('aggregateActivityData start 坐标', () => {
  it('start_lat/start_lng 取第一个有效 GPS 点', () => {
    const points: TCXPoint[] = [
      { time: 0 },
      { time: 1000, lat: 30, lng: 120 },
      { time: 2000, lat: 31, lng: 121 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.start_lat).toBe(30);
    expect(r.start_lng).toBe(120);
  });

  it('没有任何 GPS 点时 start_lat/start_lng 为 undefined', () => {
    const points: TCXPoint[] = [{ time: 0 }, { time: 1000 }];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.start_lat).toBeUndefined();
    expect(r.start_lng).toBeUndefined();
  });
});

describe('aggregateActivityData summary_polyline', () => {
  it('编码全部有效 GPS 点，可解码还原', () => {
    const points: TCXPoint[] = [
      { time: 0, lat: 30, lng: 120 },
      { time: 1000, lat: 30.001, lng: 120.001 },
      { time: 2000, lat: 30.002, lng: 120.002 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.summary_polyline).not.toBe('');
    const decoded = polyline.decode(r.summary_polyline);
    expect(decoded.length).toBe(3);
    expect(decoded[0][0]).toBeCloseTo(30, 5);
    expect(decoded[0][1]).toBeCloseTo(120, 5);
    expect(decoded[2][0]).toBeCloseTo(30.002, 5);
    expect(decoded[2][1]).toBeCloseTo(120.002, 5);
  });

  it('超过 500 个 GPS 点时折线先降采样再编码', () => {
    const points: TCXPoint[] = Array.from({ length: 600 }, (_, i) => ({
      time: i * 1000,
      lat: 30 + i * 0.0001,
      lng: 120,
    }));
    const r = aggregateActivityData({ title: 't', points });
    const decoded = polyline.decode(r.summary_polyline);
    // step = ceil(600/500) = 2 → 取索引 0,2,...,598 → 300 点
    expect(decoded.length).toBe(300);
  });
});

describe('aggregateActivityData 平均速度', () => {
  it('moving_avg_speed_kmh 与 avg_speed_kmh 计算正确', () => {
    // 两个点：dt=10s，距离约 111.2m → moving_time=10s
    const points: TCXPoint[] = [
      { time: 0, lat: 0, lng: 0, speed: 40 },
      { time: 10000, lat: 0, lng: 0.001, speed: 40 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    const distKm = getHaversineDistanceMeters(0, 0, 0, 0.001) / 1000;
    expect(r.moving_time_seconds).toBe(10);
    // 0.1112km / (10/3600)h ≈ 40.0 km/h
    expect(r.moving_avg_speed_kmh).toBe(Number((distKm / (10 / 3600)).toFixed(1)));
    expect(r.avg_speed_kmh).toBe(r.moving_avg_speed_kmh);
  });

  it('moving_avg_speed_kmh 为 0 时 avg_speed_kmh 回落为 elapsed_avg_speed_kmh', () => {
    // 无坐标、无 distance → distance_meters=0 → 两种均速都为 0
    const points: TCXPoint[] = [{ time: 0 }, { time: 10000 }];
    const r = aggregateActivityData({
      title: 't',
      points,
      explicitDistanceMeters: 0,
      explicitElapsedTimeSeconds: 10,
    });
    expect(r.moving_avg_speed_kmh).toBe(0);
    expect(r.elapsed_avg_speed_kmh).toBe(0);
    expect(r.avg_speed_kmh).toBe(0);
  });
});

describe('aggregateActivityData 速度与踏频极值', () => {
  it('max_speed_kmh 只统计 <90km/h 的速度并保留 1 位小数', () => {
    const points: TCXPoint[] = [
      { time: 0, speed: 95 },   // >=90 → 不统计
      { time: 10000, speed: 45.44 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.max_speed_kmh).toBe(45.4);
  });

  it('cadence 平均值只统计 >0 的点，最大值取所有有效值', () => {
    const points: TCXPoint[] = [
      { time: 0, cadence: 80 },
      { time: 1000, cadence: 0 },
      { time: 2000, cadence: 100 },
    ];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.max_cadence).toBe(100);
    expect(r.avg_cadence).toBe(90); // (80+100)/2
  });

  it('无 cadence 数据时 avg/max cadence 为 0', () => {
    const points: TCXPoint[] = [{ time: 0 }];
    const r = aggregateActivityData({ title: 't', points });
    expect(r.avg_cadence).toBe(0);
    expect(r.max_cadence).toBe(0);
  });
});

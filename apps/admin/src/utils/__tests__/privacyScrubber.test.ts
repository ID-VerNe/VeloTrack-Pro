import { describe, it, expect } from 'vitest';
import { scrubPrivacyZones, type PrivacyZone } from '../privacyScrubber';
import type { ParsedTCX } from '../activityAggregator';

/**
 * 隐私脱敏回归测试。
 * 圆心定为 (30.0, 120.0)，半径 200m。
 * 换算参考（纬度 30°）：1° 纬度 ≈ 111320m，1° 经度 ≈ 111320·cos(30°) ≈ 96404m
 */

const ZONE: PrivacyZone = {
  id: 'zone-home',
  name: '家',
  latitude: 30.0,
  longitude: 120.0,
  radius_meters: 200,
};

function makeRide(points: { lat?: number; lng?: number; time?: number }[]): ParsedTCX {
  return {
    id: 'test-ride',
    title: '测试骑行',
    start_time: 1700000000000,
    end_time: 1700003600000,
    elapsed_time_seconds: 3600,
    moving_time_seconds: 3000,
    distance_meters: 30000,
    max_speed_kmh: 40,
    avg_speed_kmh: 30,
    total_ascent_meters: 100,
    total_descent_meters: 100,
    max_altitude_meters: 50,
    avg_heart_rate: 140,
    max_heart_rate: 170,
    avg_cadence: 85,
    max_cadence: 110,
    calories: 500,
    hr_z1_seconds: 600,
    hr_z2_seconds: 1200,
    hr_z3_seconds: 600,
    hr_z4_seconds: 400,
    hr_z5_seconds: 200,
    summary_polyline: '',
    points: points.map((p, i) => ({
      time: p.time ?? 1700000000000 + i * 10000,
      lat: p.lat,
      lng: p.lng,
    })),
  };
}

describe('scrubPrivacyZones 隐私脱敏', () => {
  it('无隐私圈时原样返回，不做任何修改', () => {
    const ride = makeRide([{ lat: 30.0, lng: 120.0 }]);
    const result = scrubPrivacyZones(ride, []);
    expect(result).toBe(ride);
  });

  it('圈内的采样点坐标被擦除', () => {
    // (30.0005, 120.0) 距圆心约 56m，在 200m 圈内
    const ride = makeRide([{ lat: 30.0005, lng: 120.0 }]);
    const result = scrubPrivacyZones(ride, [ZONE]);
    expect(result.points[0].lat).toBeUndefined();
    expect(result.points[0].lng).toBeUndefined();
  });

  it('【核心回归】两点均在圈外但连线穿越隐私圈时，两点一并擦除', () => {
    // (30.0, 119.997) 与 (30.0, 120.003) 各距圆心约 289m（圈外），
    // 但连线穿过圆心。修复前该场景完全不处理，轨迹弦会穿透隐私圈
    const ride = makeRide([
      { lat: 30.0, lng: 119.997 },
      { lat: 30.0, lng: 120.003 },
    ]);
    const result = scrubPrivacyZones(ride, [ZONE]);
    expect(result.points[0].lat).toBeUndefined();
    expect(result.points[0].lng).toBeUndefined();
    expect(result.points[1].lat).toBeUndefined();
    expect(result.points[1].lng).toBeUndefined();
  });

  it('远离隐私圈的正常轨迹点保持原坐标', () => {
    // 距圆心约 964m，既不在圈内、连线也不穿圈、也不在起点缓冲区内
    const ride = makeRide([
      { lat: 30.0, lng: 119.98 },
      { lat: 30.0, lng: 119.975 },
    ]);
    const result = scrubPrivacyZones(ride, [ZONE]);
    expect(result.points[0].lat).toBe(30.0);
    expect(result.points[0].lng).toBe(119.98);
    expect(result.points[1].lat).toBe(30.0);
    expect(result.points[1].lng).toBe(119.975);
  });

  it('【核心回归】起点在圈内时，start 坐标取第一个距圆心超过半径+300m 的安全点', () => {
    // 点0距圆心约 56m（圈内）；点1距圆心约 404m（圈外但 < 500m 起点缓冲区）；
    // 点2距圆心约 964m（> 200+300，安全）
    const ride = makeRide([
      { lat: 30.0005, lng: 120.0 },
      { lat: 30.0, lng: 119.9958 },
      { lat: 30.0, lng: 119.99 },
    ]);
    const result = scrubPrivacyZones(ride, [ZONE]);
    // 修复前 start_lat/start_lng 保留原始圈内起点坐标明文上传
    expect(result.start_lat).toBe(30.0);
    expect(result.start_lng).toBe(119.99);
    // 前两个点均被擦除（圈内 + 起点缓冲区）
    expect(result.points[0].lat).toBeUndefined();
    expect(result.points[1].lat).toBeUndefined();
    expect(result.points[2].lat).toBe(30.0);
  });

  it('整条轨迹都在隐私圈附近无安全点时，start 坐标置空而非泄露圈边坐标', () => {
    const ride = makeRide([
      { lat: 30.0005, lng: 120.0 },
      { lat: 30.0009, lng: 120.0 },
    ]);
    const result = scrubPrivacyZones(ride, [ZONE]);
    expect(result.start_lat).toBeUndefined();
    expect(result.start_lng).toBeUndefined();
  });

  it('发生过擦除时 summary_polyline 基于擦除后的点重建，解码后不含圈内坐标', async () => {
    const polylineMod = await import('@mapbox/polyline');
    // 点0 圈内(56m)；点1(1446m) 与点0 连线穿圈 → 一并擦除；
    // 点2(1928m)、点3(2410m) 与前点连线均远离圈 → 保留
    const ride = makeRide([
      { lat: 30.0005, lng: 120.0 },
      { lat: 30.0, lng: 119.985 },
      { lat: 30.0, lng: 119.98 },
      { lat: 30.0, lng: 119.975 },
    ]);
    const result = scrubPrivacyZones(ride, [ZONE]);
    expect(result.summary_polyline).not.toBe('');
    const decoded = polylineMod.default
      ? polylineMod.default.decode(result.summary_polyline)
      : polylineMod.decode(result.summary_polyline);
    // 重建后的折线只包含安全段两点，不含被擦除的圈内/圈边坐标
    expect(decoded.length).toBe(2);
    expect(decoded[0][0]).toBeCloseTo(30.0, 5);
    expect(decoded[0][1]).toBeCloseTo(119.98, 5);
    expect(decoded[1][1]).toBeCloseTo(119.975, 5);
  });
});

// apps/web/src/utils/routeGeoJsonBuilder.ts
//
// 统一骑行速度分段 GeoJSON 构造与视觉状态分类纯函数
// 遵循单一职责（SRP）原则，解耦地图渲染器与底层动力学几何切分计算。

import { computeDistanceMeters } from './activity/geoCalculations';

export type SegmentStatus = 'paused' | 'tempo' | 'cruising' | 'sprint';

export interface SegmentStyle {
  color: string;
  status: SegmentStatus;
  speedKmh: number;
}

export interface SpeedSegmentFeature {
  type: 'Feature';
  properties: {
    color: string;
    speed: number;
    status: SegmentStatus;
    segmentIndex: number;
  };
  geometry: {
    type: 'LineString';
    coordinates: [[number, number], [number, number]];
  };
}

export interface MilestonePosition {
  km: number;
  coord: [number, number];
}

export interface BuildRouteResult {
  features: SpeedSegmentFeature[];
  milestones: MilestonePosition[];
}

export const SPEED_SEGMENT_COLORS = {
  paused: '#94A3B8', // Slate-400 (停顿/低速)
  tempo: '#F59E0B',  // Amber-500 (起步/爬坡)
  cruising: '#10B981', // Emerald-500 (巡航区间)
  sprint: '#EF4444', // Rose-500 (高速冲刺)
} as const;

/**
 * 依据距离、停顿与平均时速评估单一路段的速度与视觉色彩分类
 */
export function classifySegmentSpeed(
  rawDist: number,
  isPauseZone: boolean,
  avgMovingStep: number,
  movingAvgSpeedKmh: number,
  maxSpeedKmh: number
): SegmentStyle {
  if (isPauseZone) {
    return {
      color: SPEED_SEGMENT_COLORS.paused,
      status: 'paused',
      speedKmh: 0,
    };
  }

  const normalizedSpeed = (rawDist / Math.max(1, avgMovingStep)) * movingAvgSpeedKmh;
  const speedKmh = Number(Math.max(6.0, Math.min(maxSpeedKmh, normalizedSpeed)).toFixed(1));

  if (speedKmh >= 28) {
    return { color: SPEED_SEGMENT_COLORS.sprint, status: 'sprint', speedKmh };
  }
  if (speedKmh >= 20) {
    return { color: SPEED_SEGMENT_COLORS.cruising, status: 'cruising', speedKmh };
  }
  return { color: SPEED_SEGMENT_COLORS.tempo, status: 'tempo', speedKmh };
}

/**
 * 构造多段染色 LineString GeoJSON 特性集合与 5km 里程碑点位
 */
export function buildRouteSpeedFeatures(
  adaptedCoords: [number, number][],
  stepDistances: number[],
  pauseCoordIndices: Set<number>,
  movingAvgSpeedKmh: number,
  maxSpeedKmh: number,
  avgMovingStep: number
): BuildRouteResult {
  const numCoords = adaptedCoords.length;
  const features: SpeedSegmentFeature[] = [];
  const milestones: MilestonePosition[] = [];
  let accumulatedMeters = 0;
  let nextMilestoneKm = 5;

  for (let i = 0; i < numCoords - 1; i++) {
    const p1 = adaptedCoords[i];
    const p2 = adaptedCoords[i + 1];
    const dist = computeDistanceMeters(p1, p2);
    accumulatedMeters += dist;

    const isPauseZone =
      (stepDistances[i] !== undefined && stepDistances[i] < 3.2) ||
      pauseCoordIndices.has(i) ||
      pauseCoordIndices.has(i + 1);

    const rawDist = stepDistances[i] || dist;
    const style = classifySegmentSpeed(
      rawDist,
      isPauseZone,
      avgMovingStep,
      movingAvgSpeedKmh,
      maxSpeedKmh
    );

    features.push({
      type: 'Feature',
      properties: {
        color: style.color,
        speed: style.speedKmh,
        status: style.status,
        segmentIndex: i,
      },
      geometry: {
        type: 'LineString',
        coordinates: [p1, p2],
      },
    });

    const accumulatedKm = accumulatedMeters / 1000;
    if (accumulatedKm >= nextMilestoneKm && nextMilestoneKm < accumulatedMeters / 1000 + 5) {
      milestones.push({
        km: nextMilestoneKm,
        coord: p2,
      });
      nextMilestoneKm += 5;
    }
  }

  return { features, milestones };
}

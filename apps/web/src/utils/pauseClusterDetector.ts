/**
 * 轨迹静止停顿区识别、多点聚类与战术踩踏建议分配引擎
 */

import { computeDistanceMeters } from './activity/geoCalculations';

export interface PauseCluster {
  id: string;
  coordIndex: number;
  coord: [number, number];
  distanceKm: number;
  timeOffsetMins: number;
  durationSeconds: number;
  durationMins: number;
  title: string;
  advice: string;
}

export interface PauseDetectionResult {
  pauseClusters: PauseCluster[];
  stepDistances: number[];
  cumulativeDistances: number[];
}

/**
 * 识别轨迹中真实的静止停顿区（滑动窗口位移接近 0 的点）并聚类为独立停顿事件
 */
export function detectPauseClusters(
  routeCoordinates: [number, number][],
  totalPausedSecs: number,
  totalElapsedSecs: number
): PauseDetectionResult {
  const numCoords = routeCoordinates?.length || 0;
  const pauseClusters: PauseCluster[] = [];

  // 1. 计算所有相邻 GPS 点之间的真实位移与累计距离
  const stepDistances: number[] = [];
  const cumulativeDistances: number[] = [0];
  let calculatedDistTotal = 0;

  if (numCoords > 1) {
    for (let i = 0; i < numCoords - 1; i++) {
      const d = computeDistanceMeters(routeCoordinates[i], routeCoordinates[i + 1]);
      stepDistances.push(d);
      calculatedDistTotal += d;
      cumulativeDistances.push(calculatedDistTotal);
    }
  }

  // 2. 识别轨迹中真实的静止停顿区（滑动窗口位移接近 0 的点）
  const windowSize = 3;
  const rawStationaryIndices: number[] = [];

  if (stepDistances.length > 0 && totalPausedSecs >= 60) {
    for (let i = 0; i < stepDistances.length; i++) {
      const wStart = Math.max(0, i - windowSize);
      const wEnd = Math.min(stepDistances.length - 1, i + windowSize);
      let wSum = 0;
      for (let k = wStart; k <= wEnd; k++) wSum += stepDistances[k];
      const avgStep = wSum / (wEnd - wStart + 1);

      if (avgStep < 3.2) {
        rawStationaryIndices.push(i);
      }
    }
  }

  // 3. 将连续的静止点聚类为独立的真实停顿事件
  const clusterGroups: number[][] = [];
  let currentGroup: number[] = [];

  rawStationaryIndices.forEach((idx) => {
    if (currentGroup.length === 0 || idx - currentGroup[currentGroup.length - 1] <= 4) {
      currentGroup.push(idx);
    } else {
      if (currentGroup.length >= 2) clusterGroups.push(currentGroup);
      currentGroup = [idx];
    }
  });
  if (currentGroup.length >= 2) clusterGroups.push(currentGroup);

  // 4. 将实际真实停顿总时间 (totalPausedSecs) 按聚类规模分配至各个实际停顿点
  if (clusterGroups.length > 0 && totalPausedSecs >= 60) {
    const totalGroupPoints = clusterGroups.reduce((acc, g) => acc + g.length, 0);

    clusterGroups.forEach((group, gIdx) => {
      const centerCoordIdx = group[Math.floor(group.length / 2)];
      const ratio = group.length / Math.max(1, totalGroupPoints);
      const stopSecs = Math.max(30, Math.round(totalPausedSecs * ratio));
      const stopMins = Number((stopSecs / 60).toFixed(1));

      const distAtStop = Number(((cumulativeDistances[centerCoordIdx] || 0) / 1000).toFixed(2));
      const timeOffsetMins = Number(((centerCoordIdx / Math.max(1, numCoords)) * (totalElapsedSecs / 60)).toFixed(1));

      const title =
        clusterGroups.length === 1
          ? '路口红绿灯停顿'
          : gIdx === 0
          ? '第 1 处红绿灯路口'
          : gIdx === 1
          ? '第 2 处路口等待'
          : `第 ${gIdx + 1} 处停顿点`;

      const advice =
        gIdx === 0
          ? '起步防护：提前降档至 46/19T 轻齿比，高踏频平稳起步，防膝盖半月板瞬间超负荷'
          : '中后程衔接：绿灯亮起保持 85-90rpm 轻踏起步，平稳过渡至 46/17T 巡航甜点';

      pauseClusters.push({
        id: `pause-cluster-${gIdx}`,
        coordIndex: centerCoordIdx,
        coord: routeCoordinates[centerCoordIdx] || routeCoordinates[0],
        distanceKm: distAtStop,
        timeOffsetMins,
        durationSeconds: stopSecs,
        durationMins: stopMins,
        title,
        advice,
      });
    });
  }

  return {
    pauseClusters,
    stepDistances,
    cumulativeDistances,
  };
}

/**
 * 自行车真实运动学遥测微观分析与轨迹数据映射引擎
 *
 * 两种渲染模式：
 * 1. 实测模式（优先）：admin 上传时逐点明细（海拔/速度/时间/心率）存入 R2，
 *    rides API 返回 detailPoints，本引擎直接用实测值渲染海拔与速度曲线。
 * 2. 示意模式（降级）：旧数据无明细时，基于 GPS 位移推算速度、
 *    以正弦曲线拟合海拔形状（仅用总爬升/最高海拔两个汇总值），
 *    前端必须标注"示意"字样，不得冒充实测。
 */

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

export interface ChartTelemetryPoint {
  index: number;
  totalPoints: number;
  progress: number;
  coordIndex: number;
  coord?: [number, number];
  timeLabel: string;
  speed: number;
  altitude: number;
  distanceKm: number;
  status: 'cruising' | 'paused' | 'climbing' | 'tempo' | 'normal';
  statusLabel: string;
}

/**
 * R2 逐点明细（与 admin 端 DetailPoint 格式对齐，短字段名减小存储体积）。
 * t=时间戳ms, la/ln=坐标（隐私圈内点缺省）, al=海拔m, hr=心率, cd=踏频, sp=瞬时速度km/h
 */
export interface RideDetailPoint {
  t: number;
  la?: number;
  ln?: number;
  al?: number;
  hr?: number;
  cd?: number;
  sp?: number;
}

// 辅助计算两经纬度点之间的球面距离 (米)
export function computeDistanceMeters(coord1: [number, number], coord2: [number, number]): number {
  const R = 6371e3;
  const phi1 = (coord1[1] * Math.PI) / 180;
  const phi2 = (coord2[1] * Math.PI) / 180;
  const dPhi = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const dLambda = ((coord2[0] - coord1[0]) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 空间反查：根据地图光标位置找到最近的轨迹点及对应的图表采样点索引
 */
export function findClosestTelemetryIndex(
  targetCoord: [number, number],
  routeCoordinates: [number, number][],
  totalTelemetryPoints: number
): { coordIndex: number; chartIndex: number; distanceMeters: number } {
  if (!routeCoordinates || routeCoordinates.length === 0) {
    return { coordIndex: 0, chartIndex: 0, distanceMeters: Infinity };
  }

  let minDistance = Infinity;
  let closestCoordIdx = 0;

  for (let i = 0; i < routeCoordinates.length; i++) {
    const dist = computeDistanceMeters(targetCoord, routeCoordinates[i]);
    if (dist < minDistance) {
      minDistance = dist;
      closestCoordIdx = i;
    }
  }

  const progress = closestCoordIdx / Math.max(1, routeCoordinates.length - 1);
  const chartIndex = Math.min(
    totalTelemetryPoints - 1,
    Math.max(0, Math.round(progress * (totalTelemetryPoints - 1)))
  );

  return { coordIndex: closestCoordIdx, chartIndex, distanceMeters: minDistance };
}

export function analyzeRideTelemetry(
  ride: any,
  routeCoordinates: [number, number][],
  detailPoints?: RideDetailPoint[] | null
) {
  const totalElapsedSecs = ride?.elapsed_time_seconds || ride?.moving_time_seconds || 3600;
  const movingSecs = ride?.moving_time_seconds || totalElapsedSecs;
  const totalPausedSecs = Math.max(0, totalElapsedSecs - movingSecs);

  const totalDistMeters = ride?.distance_meters || 0;
  const totalDistKm = Number((totalDistMeters / 1000).toFixed(2));
  const movingAvgSpeedKmh =
    movingSecs > 0 ? Number((totalDistKm / (movingSecs / 3600)).toFixed(1)) : 0;
  const elapsedAvgSpeedKmh =
    totalElapsedSecs > 0 ? Number((totalDistKm / (totalElapsedSecs / 3600)).toFixed(1)) : 0;

  const maxSpeedKmh = ride?.max_speed_kmh || Math.max(30, Number((movingAvgSpeedKmh * 1.4).toFixed(1)));
  const maxAltMeters = ride?.max_altitude_meters || 45;
  const elevGain = ride?.total_ascent_meters || 30;

  const movingRatioPct = Math.min(100, Math.round((movingSecs / totalElapsedSecs) * 100));
  const pausedRatioPct = 100 - movingRatioPct;

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

  // 5. 生成图表数据点：优先实测明细（R2 detailPoints），降级为示意合成
  const timeLabels: string[] = [];
  const speedPoints: number[] = [];
  const altPoints: number[] = [];
  const telemetryPoints: ChartTelemetryPoint[] = [];
  const markAreas: any[] = [];

  let maxSpeedFound = -Infinity;
  let maxSpeedPointIndex = 0;
  let maxAltFound = -Infinity;
  let maxAltPointIndex = 0;

  // 速度→状态分类（两种模式共用）
  const classifySpeedState = (speed: number): {
    status: ChartTelemetryPoint['status'];
    statusLabel: string;
  } => {
    if (speed >= 21) {
      return { status: 'cruising', statusLabel: `高速巡航 (${speed} km/h)` };
    }
    if (speed < 15 && elevGain > 40) {
      return { status: 'climbing', statusLabel: `爬坡/起步 (${speed} km/h)` };
    }
    return { status: 'tempo', statusLabel: `节奏骑行 (${speed} km/h)` };
  };

  const usableDetail =
    Array.isArray(detailPoints) && detailPoints.length >= 2 ? detailPoints : null;

  let numChartPoints: number;

  if (usableDetail) {
    // ===== 实测模式：海拔/速度/时间全部来自码表记录的逐点明细 =====
    numChartPoints = usableDetail.length;
    const t0 = usableDetail[0].t;
    let lastValidAlt: number | null = null;
    let lastCoord: [number, number] | null = null;
    let lastSpeed: number | null = null;
    let cumDist = 0;

    for (let s = 0; s < numChartPoints; s++) {
      const dp = usableDetail[s];
      const progress = numChartPoints > 1 ? s / (numChartPoints - 1) : 0;
      const coordIdx = Math.min(numCoords - 1, Math.floor(progress * Math.max(1, numCoords - 1)));

      // 累计距离：基于明细自身坐标（隐私圈内无坐标段距离不增长）
      if (dp.la !== undefined && dp.ln !== undefined) {
        const cur: [number, number] = [dp.la, dp.ln];
        if (lastCoord) cumDist += computeDistanceMeters(lastCoord, cur);
        lastCoord = cur;
      }
      const currentDist = Number((cumDist / 1000).toFixed(2));

      // 时间标签：相对骑行走点的实测时间
      const relSec = Math.max(0, Math.round((dp.t - t0) / 1000));
      const timeStr = `${String(Math.floor(relSec / 60)).padStart(2, '0')}:${String(relSec % 60).padStart(2, '0')}`;
      timeLabels.push(timeStr);

      // 速度：优先实测 sp；缺失时用相邻点位移/时差推算；再缺则沿用前值
      let speed = dp.sp;
      if (speed === undefined || !Number.isFinite(speed)) {
        const next = usableDetail[s + 1];
        if (
          next &&
          next.t > dp.t &&
          dp.la !== undefined && dp.ln !== undefined &&
          next.la !== undefined && next.ln !== undefined
        ) {
          const d = computeDistanceMeters([dp.la, dp.ln], [next.la, next.ln]);
          speed = (d / ((next.t - dp.t) / 1000)) * 3.6;
        } else if (lastSpeed !== null) {
          speed = lastSpeed;
        } else {
          speed = 0;
        }
      }
      speed = Number(Math.max(0, speed).toFixed(1));
      lastSpeed = speed;

      // 海拔：实测 al；缺失段沿用前一个有效值
      let alt: number;
      if (dp.al !== undefined && Number.isFinite(dp.al)) {
        alt = dp.al;
        lastValidAlt = dp.al;
      } else {
        alt = lastValidAlt ?? 0;
      }

      // 实测低速即为真实停顿，无需位移推断
      let status: ChartTelemetryPoint['status'];
      let statusLabel: string;
      if (speed < 2) {
        status = 'paused';
        const cluster = pauseClusters.find((pc) => Math.abs(pc.coordIndex - coordIdx) <= 6);
        statusLabel = cluster ? `${cluster.title} (${cluster.durationMins}分)` : '停顿等待';
      } else {
        ({ status, statusLabel } = classifySpeedState(speed));
      }

      speedPoints.push(speed);
      altPoints.push(alt);

      if (speed > maxSpeedFound) {
        maxSpeedFound = speed;
        maxSpeedPointIndex = s;
      }
      if (alt > maxAltFound) {
        maxAltFound = alt;
        maxAltPointIndex = s;
      }

      telemetryPoints.push({
        index: s,
        totalPoints: numChartPoints,
        progress,
        coordIndex: coordIdx,
        coord: routeCoordinates[coordIdx] || routeCoordinates[0],
        timeLabel: timeStr,
        speed,
        altitude: alt,
        distanceKm: currentDist,
        status,
        statusLabel,
      });
    }
  } else {
    // ===== 示意模式（降级）：旧数据无逐点明细时的估算渲染，前端须标注"示意" =====
    numChartPoints = Math.min(120, Math.max(30, numCoords > 0 ? numCoords : 45));

    // 计算平均有效步长，用于速度换算比例归一化
    const movingSteps = stepDistances.filter((d) => d >= 3.2);
    const avgMovingStep =
      movingSteps.length > 0
        ? movingSteps.reduce((a, b) => a + b, 0) / movingSteps.length
        : 15;

    const pauseCoordSet = new Set(pauseClusters.map((pc) => pc.coordIndex));

    for (let s = 0; s < numChartPoints; s++) {
      const progress = numChartPoints > 1 ? s / (numChartPoints - 1) : 0;
      const coordIdx = Math.min(numCoords - 1, Math.floor(progress * Math.max(1, numCoords - 1)));
      const currentDist = Number(((cumulativeDistances[coordIdx] || 0) / 1000).toFixed(2));

      const timeSec = Math.round(progress * totalElapsedSecs);
      const m = Math.floor(timeSec / 60);
      const sec = timeSec % 60;
      const timeStr = `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      timeLabels.push(timeStr);

      // 计算当前局部位移速度
      let rawStepDist = 0;
      if (stepDistances.length > 0) {
        const wStart = Math.max(0, coordIdx - 2);
        const wEnd = Math.min(stepDistances.length - 1, coordIdx + 2);
        let wSum = 0;
        for (let k = wStart; k <= wEnd; k++) wSum += stepDistances[k];
        rawStepDist = wSum / (wEnd - wStart + 1);
      }

      const isNearPause =
        rawStepDist < 3.2 ||
        Array.from(pauseCoordSet).some((pIdx) => Math.abs(pIdx - coordIdx) <= 3);

      let speed = 0.0;
      let status: 'cruising' | 'paused' | 'climbing' | 'tempo' | 'normal' = 'normal';
      let statusLabel = '正常骑行';

      if (isNearPause && totalPausedSecs >= 60) {
        speed = 0.0;
        status = 'paused';
        const cluster = pauseClusters.find((pc) => Math.abs(pc.coordIndex - coordIdx) <= 6);
        statusLabel = cluster ? `⏸️ ${cluster.title} (${cluster.durationMins}分)` : '⏸️ 停顿/等红灯';
      } else {
        // 速度估算：按实际 GPS 位移与停表均速线性校准（非码表实测值）
        const normalizedSpeed = (rawStepDist / Math.max(1, avgMovingStep)) * movingAvgSpeedKmh;
        speed = Number(Math.max(6.0, Math.min(maxSpeedKmh, normalizedSpeed)).toFixed(1));
        ({ status, statusLabel } = classifySpeedState(speed));
      }

      // 海拔示意曲线：仅用最高海拔+总爬升两个汇总值拟合的拱形，非实测
      const altProgress = Math.sin(progress * Math.PI);
      const baseAlt = Math.max(3, maxAltMeters - elevGain * 0.7);
      const alt = Number((baseAlt + altProgress * elevGain * 0.65).toFixed(0));

      speedPoints.push(speed);
      altPoints.push(alt);

      if (speed > maxSpeedFound) {
        maxSpeedFound = speed;
        maxSpeedPointIndex = s;
      }
      if (alt > maxAltFound) {
        maxAltFound = alt;
        maxAltPointIndex = s;
      }

      telemetryPoints.push({
        index: s,
        totalPoints: numChartPoints,
        progress,
        coordIndex: coordIdx,
        coord: routeCoordinates[coordIdx] || routeCoordinates[0],
        timeLabel: timeStr,
        speed,
        altitude: alt,
        distanceKm: currentDist,
        status,
        statusLabel,
      });
    }
  }

  // 6. 为每个真实检测到的停顿点生成柔和的 MarkArea 背景条带（不显示重叠文字）
  pauseClusters.forEach((cluster) => {
    const chartIdx = Math.min(
      numChartPoints - 1,
      Math.max(0, Math.round((cluster.coordIndex / Math.max(1, numCoords)) * (numChartPoints - 1)))
    );
    const timeLabel = timeLabels[chartIdx];

    if (timeLabel) {
      markAreas.push([
        {
          name: cluster.title,
          xAxis: timeLabel,
          itemStyle: { color: 'rgba(244, 63, 94, 0.10)' },
          label: { show: false },
        },
        { xAxis: timeLabel },
      ]);
    }
  });

  const longestPauseCluster =
    pauseClusters.length > 0
      ? [...pauseClusters].sort((a, b) => b.durationSeconds - a.durationSeconds)[0]
      : null;

  return {
    pauseClusters,
    telemetryPoints,
    isRealData: !!usableDetail,
    chartData: { timeLabels, speedPoints, altPoints, numPoints: numChartPoints },
    markAreas,
    stepDistances,
    cumulativeDistances,
    keyPeakIndices: {
      maxSpeedPointIndex,
      maxAltPointIndex,
      longestPauseCluster,
    },
    stats: {
      totalElapsedSecs,
      movingSecs,
      totalPausedSecs,
      elapsedMins: Number((totalElapsedSecs / 60).toFixed(1)),
      movingMins: Number((movingSecs / 60).toFixed(1)),
      pausedMins: Number((totalPausedSecs / 60).toFixed(1)),
      movingRatioPct,
      pausedRatioPct,
      movingAvgSpeedKmh,
      elapsedAvgSpeedKmh,
      maxSpeedKmh,
      totalDistKm,
    },
  };
}

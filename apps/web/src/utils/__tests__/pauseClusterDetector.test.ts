import { describe, it, expect } from 'vitest';
import { detectPauseClusters } from '../pauseClusterDetector';

describe('detectPauseClusters', () => {
  it('returns empty clusters if totalPausedSecs is less than 60s', () => {
    const coords: [number, number][] = [
      [114.0, 22.5],
      [114.0001, 22.5001],
      [114.0002, 22.5002],
    ];
    const res = detectPauseClusters(coords, 30, 1800);
    expect(res.pauseClusters).toEqual([]);
    expect(res.stepDistances).toHaveLength(2);
  });

  it('detects and clusters stationary GPS points into pause events', () => {
    // 构造包含 12 个重合点（静止）的轨迹，确保滑动窗口 avgStep < 3.2
    const coords: [number, number][] = [[114.0, 22.5]];
    for (let i = 0; i < 12; i++) coords.push([114.002, 22.502]);
    coords.push([114.004, 22.504]);

    const res = detectPauseClusters(coords, 180, 2000);
    expect(res.pauseClusters.length).toBeGreaterThanOrEqual(1);

    const firstCluster = res.pauseClusters[0];
    expect(firstCluster.title).toContain('路口');
    expect(firstCluster.advice).toContain('起步防护');
    expect(firstCluster.durationSeconds).toBeGreaterThanOrEqual(30);
  });
});

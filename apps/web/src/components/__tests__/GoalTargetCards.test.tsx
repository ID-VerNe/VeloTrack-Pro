// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import GoalTargetCards from '../goals/GoalTargetCards';

/**
 * GoalTargetCards 目标进度卡片测试
 * 覆盖：四项目标百分比计算、进度条宽度封顶、0 值兜底（避免 NaN）
 */

const targets = {
  weeklyDistanceKm: 50,
  targetAvgSpeedKmh: 20,
  monthlyDistanceKm: 150,
  annualDistanceKm: 1000,
};

const realStats = {
  thisWeekDistanceKm: 25,
  bestAvgSpeedKmh: 22,
  thisMonthDistanceKm: 75,
  totalDistanceKm: 500,
};

describe('GoalTargetCards', () => {
  it('渲染四张卡片标题与进度百分比', () => {
    render(<GoalTargetCards targets={targets} realStats={realStats} />);
    expect(screen.getByText('单周里程目标')).toBeInTheDocument();
    expect(screen.getByText('目标巡航均速')).toBeInTheDocument();
    expect(screen.getByText('月度总跑量')).toBeInTheDocument();
    expect(screen.getByText('年度累计里程')).toBeInTheDocument();
    // 25/50=50%，22/20=110% → 达成 110%，75/150=50%，500/1000=50%
    expect(screen.getAllByText('50%').length).toBe(3); // 周/月/年均为 50%
    expect(screen.getByText('达成 110%')).toBeInTheDocument();
  });

  it('进度条宽度被限制在 100% 以内', () => {
    const over = { ...realStats, bestAvgSpeedKmh: 40 }; // 200%
    const { container } = render(<GoalTargetCards targets={targets} realStats={over} />);
    const bars = container.querySelectorAll('[style*="width: 100%"]');
    expect(bars.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[style*="width: 200%"]').length).toBe(0);
  });

  it('目标为 0 时使用默认分母，避免 NaN', () => {
    const zeroTargets = {
      weeklyDistanceKm: 0,
      targetAvgSpeedKmh: 0,
      monthlyDistanceKm: 0,
      annualDistanceKm: 0,
    };
    const zeroStats = {
      thisWeekDistanceKm: 0,
      bestAvgSpeedKmh: 0,
      thisMonthDistanceKm: 0,
      totalDistanceKm: 0,
    };
    const { container } = render(
      <GoalTargetCards targets={zeroTargets} realStats={zeroStats} />
    );
    expect(container.textContent).not.toContain('NaN');
    expect(screen.getAllByText('0%').length).toBeGreaterThanOrEqual(3);
  });
});

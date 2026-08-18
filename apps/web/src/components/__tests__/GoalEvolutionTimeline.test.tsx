// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import GoalEvolutionTimeline from '../goals/GoalEvolutionTimeline';
import type { GoalMilestone } from '../../types/rider';

/**
 * GoalEvolutionTimeline 阶段目标演进记录组件测试。
 * 覆盖：空态返回 null、里程碑渲染、数据格式、最新标记、来源标签。
 */
describe('GoalEvolutionTimeline 阶段目标演进', () => {
  const baseTimestamp = 1_700_000_000;

  const makeMilestones = (): GoalMilestone[] => [
    {
      id: 1,
      weekly_distance_km: 50,
      target_avg_speed_kmh: 18,
      primary_goal: '市区巡航均速达到 18km/h',
      rationale: '根据近期实战数据调整',
      source: 'coach',
      created_at: baseTimestamp,
    },
    {
      id: 2,
      weekly_distance_km: 60,
      target_avg_speed_kmh: 20,
      primary_goal: '进阶巡航 20km/h 目标',
      rationale: '手动录入的进阶目标',
      source: 'manual',
      created_at: baseTimestamp + 86400,
    },
  ];

  it('milestones 为空时返回 null', () => {
    const { container } = render(<GoalEvolutionTimeline milestones={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('milestones 为 undefined 时返回 null', () => {
    const { container } = render(<GoalEvolutionTimeline milestones={undefined as any} />);
    expect(container.innerHTML).toBe('');
  });

  it('渲染里程碑列表与标题', () => {
    render(<GoalEvolutionTimeline milestones={makeMilestones()} />);
    expect(screen.getByText(/阶段目标演进记录/)).toBeInTheDocument();
    expect(screen.getByText('市区巡航均速达到 18km/h')).toBeInTheDocument();
    expect(screen.getByText('进阶巡航 20km/h 目标')).toBeInTheDocument();
  });

  it('渲染量化目标徽标', () => {
    render(<GoalEvolutionTimeline milestones={makeMilestones()} />);
    expect(screen.getByText('50').parentElement).toHaveTextContent(/单周/);
    expect(screen.getByText('60').parentElement).toHaveTextContent(/单周/);
  });

  it('第一个里程碑标记为"当前生效中"', () => {
    render(<GoalEvolutionTimeline milestones={makeMilestones()} />);
    expect(screen.getByText('当前生效中')).toBeInTheDocument();
  });

  it('coach 来源标记为"系统自适应调优"，manual 为"车手手动设定"', () => {
    render(<GoalEvolutionTimeline milestones={makeMilestones()} />);
    expect(screen.getByText('系统自适应调优')).toBeInTheDocument();
    expect(screen.getByText('车手手动设定')).toBeInTheDocument();
  });

  it('渲染演进依据', () => {
    render(<GoalEvolutionTimeline milestones={makeMilestones()} />);
    expect(screen.getByText(/根据近期实战数据调整/)).toBeInTheDocument();
    expect(screen.getByText(/手动录入的进阶目标/)).toBeInTheDocument();
  });
});

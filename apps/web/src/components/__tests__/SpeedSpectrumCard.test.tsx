// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SpeedSpectrumCard from '../ride-detail/SpeedSpectrumCard';
import { SpeedTierBreakdown } from '../../utils/speedDistribution';

const mockTiers: SpeedTierBreakdown = {
  paused_secs: 540,
  paused_pct: 9,
  low_speed_secs: 1740,
  low_speed_pct: 29,
  tempo_secs: 2100,
  tempo_pct: 35,
  cruising_secs: 1500,
  cruising_pct: 25,
  sprint_secs: 120,
  sprint_pct: 2,
};

describe('SpeedSpectrumCard 速度时间谱系分段条组件', () => {
  it('正确渲染五级速度分层的标题与标签', () => {
    render(<SpeedSpectrumCard tiers={mockTiers} totalDurationSeconds={6000} />);
    expect(screen.getByText('速度时间谱系与区间做功分布')).toBeInTheDocument();
    expect(screen.getByText('停顿等待')).toBeInTheDocument();
    expect(screen.getByText('起步/控车')).toBeInTheDocument();
    expect(screen.getByText('节奏过渡')).toBeInTheDocument();
    expect(screen.getByText('稳态巡航')).toBeInTheDocument();
    expect(screen.getByText('冲刺极速')).toBeInTheDocument();
  });

  it('正确渲染各区间的百分比数值', () => {
    render(<SpeedSpectrumCard tiers={mockTiers} totalDurationSeconds={6000} />);
    expect(screen.getByText('9%')).toBeInTheDocument();
    expect(screen.getByText('29%')).toBeInTheDocument();
    expect(screen.getByText('35%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('2%')).toBeInTheDocument();
  });

  it('渲染进度条容器并具有对应无障碍角色', () => {
    render(<SpeedSpectrumCard tiers={mockTiers} totalDurationSeconds={6000} />);
    const progress = screen.getByRole('progressbar');
    expect(progress).toBeInTheDocument();
  });
});

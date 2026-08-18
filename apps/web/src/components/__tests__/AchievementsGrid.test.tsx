// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import AchievementsGrid from '../goals/AchievementsGrid';

/**
 * AchievementsGrid 里程碑/勋章网格测试
 * 覆盖：已解锁/未解锁渲染分支、空数据渲染标题
 */

const achievements = [
  {
    id: 'a1',
    unlocked: true,
    title: '首次单次破 40km 进阶',
    date: '2026/7/10',
    icon: '🚴',
    desc: '完成 42km',
  },
  {
    id: 'a2',
    unlocked: false,
    title: '50km/h 极速冲刺挑战',
    date: '进行中',
    icon: '⚡',
    desc: '当前 48.0 km/h',
  },
];

describe('AchievementsGrid', () => {
  it('渲染已解锁与未解锁勋章信息', () => {
    render(<AchievementsGrid achievements={achievements} />);
    expect(screen.getByText('个人里程碑与实战勋章')).toBeInTheDocument();
    expect(screen.getByText('首次单次破 40km 进阶')).toBeInTheDocument();
    expect(screen.getByText('2026/7/10')).toBeInTheDocument();
    expect(screen.getByText('50km/h 极速冲刺挑战')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByText('完成 42km')).toBeInTheDocument();
  });

  it('仅未解锁卡片应用虚线边框样式', () => {
    const { container } = render(<AchievementsGrid achievements={achievements} />);
    expect(container.querySelectorAll('.border-dashed').length).toBe(1);
  });

  it('空数组时仅渲染标题容器', () => {
    render(<AchievementsGrid achievements={[]} />);
    expect(screen.getByText('个人里程碑与实战勋章')).toBeInTheDocument();
  });
});

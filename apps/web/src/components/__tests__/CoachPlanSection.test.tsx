// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CoachPlanSection from '../goals/CoachPlanSection';

/**
 * CoachPlanSection 教练课表展示组件测试。
 * 覆盖：4 周训练计划渲染、自定义战术指导语、进入决策舱回调。
 */
describe('CoachPlanSection 教练课表', () => {
  it('渲染 4 周训练计划卡片', () => {
    render(<CoachPlanSection onAskCoach={vi.fn()} />);
    expect(screen.getByText('第 1 周')).toBeInTheDocument();
    expect(screen.getByText('第 2 周')).toBeInTheDocument();
    expect(screen.getByText('第 3 周')).toBeInTheDocument();
    expect(screen.getByText('第 4 周')).toBeInTheDocument();
    expect(screen.getByText(/高踏频有氧基底打磨/)).toBeInTheDocument();
    expect(screen.getByText(/巡航定速与节奏巩固/)).toBeInTheDocument();
  });

  it('渲染默认战术指导语', () => {
    render(<CoachPlanSection onAskCoach={vi.fn()} />);
    expect(screen.getByText(/保持85-95rpm高踏频/)).toBeInTheDocument();
  });

  it('渲染自定义战术指导语', () => {
    render(<CoachPlanSection coachNotes="自定义指导语" onAskCoach={vi.fn()} />);
    expect(screen.getByText(/自定义指导语/)).toBeInTheDocument();
  });

  it('点击"进入决策舱调整"按钮调用 onAskCoach', async () => {
    const user = userEvent.setup();
    const onAskCoach = vi.fn();
    render(<CoachPlanSection onAskCoach={onAskCoach} />);
    await user.click(screen.getByRole('button', { name: /进入决策舱调整/ }));
    expect(onAskCoach).toHaveBeenCalledTimes(1);
  });

  it('渲染各周训练量、齿比与区间', () => {
    render(<CoachPlanSection onAskCoach={vi.fn()} />);
    expect(screen.getByText('35 km (2~3 次)')).toBeInTheDocument();
    expect(screen.getByText('55 km (总体验收)')).toBeInTheDocument();
    expect(screen.getByText('Zone 2 有氧耐力')).toBeInTheDocument();
    expect(screen.getByText('Zone 3-4 巡航冲刺')).toBeInTheDocument();
  });
});

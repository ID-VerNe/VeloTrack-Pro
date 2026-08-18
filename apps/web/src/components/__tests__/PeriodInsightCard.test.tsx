// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import PeriodInsightCard from '../reports/PeriodInsightCard';

// 用最小 stub 代替 MarkdownRenderer，聚焦本组件自身逻辑（MarkdownRenderer 已有独立测试）
vi.mock('../MarkdownRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid="markdown-stub">{content}</div>
  ),
}));

/**
 * PeriodInsightCard 周期诊断卡测试
 * 覆盖：加载中/有内容/空内容三分支、按钮文案与回调
 */

describe('PeriodInsightCard', () => {
  it('加载中显示「计算中...」与加载文案，按钮禁用', () => {
    render(<PeriodInsightCard insight={null} isLoading onGenerate={vi.fn()} />);
    expect(screen.getByRole('button', { name: '计算中...' })).toBeDisabled();
    expect(screen.getByText(/正在计算周期做功负荷/)).toBeInTheDocument();
  });

  it('有 insight 时渲染内容并显示「重新诊断」', () => {
    render(<PeriodInsightCard insight="本周期负荷适中" isLoading={false} onGenerate={vi.fn()} />);
    expect(screen.getByTestId('markdown-stub')).toHaveTextContent('本周期负荷适中');
    expect(screen.getByRole('button', { name: '重新诊断' })).toBeEnabled();
  });

  it('无内容非加载时显示空态引导与「开始周期诊断」', () => {
    render(<PeriodInsightCard insight={null} isLoading={false} onGenerate={vi.fn()} />);
    expect(screen.getByText(/点击右上角「开始周期诊断」/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始周期诊断' })).toBeInTheDocument();
  });

  it('点击按钮触发 onGenerate', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();
    render(<PeriodInsightCard insight={null} isLoading={false} onGenerate={onGenerate} />);
    await user.click(screen.getByRole('button', { name: '开始周期诊断' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });
});

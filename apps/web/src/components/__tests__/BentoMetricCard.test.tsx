// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import BentoMetricCard from '../common/BentoMetricCard';

/**
 * BentoMetricCard 指标卡测试
 * 覆盖：label/value/unit/subLabel 渲染，以及可选字段缺失与 0 值分支
 */

describe('BentoMetricCard', () => {
  it('渲染 label、value、unit 与 subLabel', () => {
    render(
      <BentoMetricCard label="骑行总里程" value={125.4} unit="公里" subLabel="最高 60 km/h" />
    );
    expect(screen.getByText('骑行总里程')).toBeInTheDocument();
    expect(screen.getByText('125.4')).toBeInTheDocument();
    expect(screen.getByText('公里')).toBeInTheDocument();
    expect(screen.getByText('最高 60 km/h')).toBeInTheDocument();
  });

  it('不传 unit 时不渲染单位', () => {
    render(<BentoMetricCard label="里程" value={10} />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.queryByText('公里')).not.toBeInTheDocument();
  });

  it('不传 subLabel 时不渲染副文案', () => {
    render(<BentoMetricCard label="里程" value={10} />);
    expect(screen.queryByText('最高 60 km/h')).not.toBeInTheDocument();
  });

  it('支持数字 0 值渲染', () => {
    render(<BentoMetricCard label="里程" value={0} unit="公里" />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('透传自定义 className 到最外层卡片', () => {
    render(<BentoMetricCard label="里程" value={1} className="bg-blue-500" />);
    // 从 label 文本向上两级：label 包裹 div → 最外层卡片 div
    const card = screen.getByText('里程').closest('div')!.parentElement;
    expect(card).toHaveClass('bg-blue-500');
  });
});

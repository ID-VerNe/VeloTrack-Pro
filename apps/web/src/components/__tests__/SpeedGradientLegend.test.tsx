import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SpeedGradientLegend from '../ride-detail/SpeedGradientLegend';

describe('SpeedGradientLegend 速度谱系图例组件', () => {
  it('正确渲染四个速度区间及标题', () => {
    render(<SpeedGradientLegend className="my-custom-class" />);

    expect(screen.getByText('速度谱系:')).toBeInTheDocument();
    expect(screen.getByText('停顿/低速')).toBeInTheDocument();
    expect(screen.getByText('起步/爬坡')).toBeInTheDocument();
    expect(screen.getByText('巡航区间')).toBeInTheDocument();
    expect(screen.getByText('高速冲刺')).toBeInTheDocument();

    const container = screen.getByTestId('speed-gradient-legend');
    expect(container).toHaveClass('my-custom-class');
  });
});

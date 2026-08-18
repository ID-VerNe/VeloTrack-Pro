// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

// Mock echarts-for-react：以 data-option 暴露生成的 option 配置
vi.mock('echarts-for-react', () => ({
  default: (props: any) => <div data-testid="chart" data-option={JSON.stringify(props.option)} />,
}));

import PeriodTimelineChart from '../reports/PeriodTimelineChart';

/**
 * PeriodTimelineChart 周期里程/爬升走势图测试
 * 覆盖：双 series（里程柱状 + 爬升折线）数据映射、xAxis 标签、
 * 标题渲染、timeline 缺失时的降级。
 */

const timeline = {
  labels: ['2026-01', '2026-02', '2026-03'],
  distance: [50, 62, 45],
  ascent: [300, 410, 280],
};

/** 读取 mock 图表接收到的 option */
function getOption(): any {
  const el = screen.getByTestId('chart');
  return JSON.parse(el.getAttribute('data-option') as string);
}

describe('PeriodTimelineChart', () => {
  it('生成里程柱状与爬升折线双 series，数据与 props 对应', () => {
    render(<PeriodTimelineChart timeline={timeline} />);
    const option = getOption();

    expect(option.series).toHaveLength(2);
    expect(option.series[0].name).toBe('里程 (km)');
    expect(option.series[0].type).toBe('bar');
    expect(option.series[0].data).toEqual([50, 62, 45]);

    expect(option.series[1].name).toBe('爬升 (m)');
    expect(option.series[1].type).toBe('line');
    expect(option.series[1].data).toEqual([300, 410, 280]);
  });

  it('xAxis 标签与 legend 包含周期标签与系列名', () => {
    render(<PeriodTimelineChart timeline={timeline} />);
    const option = getOption();
    expect(option.xAxis.data).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(option.legend.data).toEqual(['里程 (km)', '爬升 (m)']);
  });

  it('渲染标题「周期内里程与爬升走势拆解」', () => {
    render(<PeriodTimelineChart timeline={timeline} />);
    expect(screen.getByText('周期内里程与爬升走势拆解')).toBeInTheDocument();
  });

  it('timeline 缺失时 option 为空对象（降级不崩溃）', () => {
    render(<PeriodTimelineChart timeline={undefined as any} />);
    const option = getOption();
    expect(option).toEqual({});
  });
});

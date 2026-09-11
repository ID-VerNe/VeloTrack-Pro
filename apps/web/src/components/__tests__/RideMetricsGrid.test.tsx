// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import RideMetricsGrid from '../ride-detail/RideMetricsGrid';

/**
 * RideMetricsGrid 骑行指标网格测试
 * 覆盖：四张指标卡渲染、数值计算（里程/均速/停顿占比）、0 值边界
 */

const ride = {
  distance_meters: 42300,
  moving_time_seconds: 5400,
  elapsed_time_seconds: 6600,
  max_speed_kmh: 52,
  total_ascent_meters: 320,
  max_altitude_meters: 210,
};

describe('RideMetricsGrid', () => {
  it('渲染四个指标卡标题', () => {
    render(<RideMetricsGrid ride={ride} calories={600} />);
    expect(screen.getByText('骑行总里程')).toBeInTheDocument();
    expect(screen.getByText('停表均速')).toBeInTheDocument();
    expect(screen.getByText('总均速')).toBeInTheDocument();
    expect(screen.getByText('累计爬升 / 能量')).toBeInTheDocument();
  });

  it('计算并渲染里程（保留两位小数）', () => {
    render(<RideMetricsGrid ride={ride} calories={600} />);
    expect(screen.getByText('42.30')).toBeInTheDocument();
  });

  it('计算停顿分钟与占比', () => {
    render(<RideMetricsGrid ride={ride} calories={600} />);
    // paused = 6600-5400 = 1200s = 20分；ratio = 100 - round(5400/6600*100) = 100-82 = 18%
    expect(screen.getByText(/停顿 20分 \(18%\)/)).toBeInTheDocument();
  });

  it('空 ride 或 0 值渲染 0 而不报错', () => {
    render(<RideMetricsGrid ride={{}} calories={0} />);
    expect(screen.getByText('0.00')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText(/最高海拔 0m · 消耗 0kcal/)).toBeInTheDocument();
  });

  it('传入 speedDistribution 时渲染稳态平路巡航、踏频与持续稳态段落卡片', () => {
    const mockSpeedDist = {
      has_detail: true,
      cruising_avg_speed_kmh: 25.4,
      cruising_range_kmh: [22.9, 25.8] as [number, number],
      speed_loss_kmh: 5.2,
      speed_loss_pct: 20,
      sustained_segments_count: 8,
      sustained_avg_speed_kmh: 23.8,
      derived_cadence_rpm: 89.6,
      cadence_zone_status: 'golden' as const,
      speed_tiers: {
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
      },
      summary_text: '测试稳态巡航',
    };

    render(<RideMetricsGrid ride={ride} calories={600} speedDistribution={mockSpeedDist} />);
    expect(screen.getByText('稳态平路巡航')).toBeInTheDocument();
    expect(screen.getByText('25.4')).toBeInTheDocument();
    expect(screen.getByText(/46\/15T 踏频 ~89.6 rpm/)).toBeInTheDocument();
    expect(screen.getByText('85-95rpm 黄金区间')).toBeInTheDocument();
    expect(screen.getByText('持续稳态巡航')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText(/速度损耗 -5.2km\/h \(20%\)/)).toBeInTheDocument();
  });
});

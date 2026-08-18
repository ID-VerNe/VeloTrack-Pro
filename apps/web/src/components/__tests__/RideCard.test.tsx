// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import RideCard from '../RideCard';

/**
 * RideCard 骑行卡片测试
 * 覆盖：数据渲染、公路/山地徽章、链接跳转、hover 回调、轨迹 SVG 与无轨迹兜底
 */

const shenzhenRide = {
  id: 'ride-1',
  title: '深圳湾公路骑行',
  distance_meters: 42000,
  moving_time_seconds: 5400,
  elapsed_time_seconds: 6600,
  start_time: new Date(2026, 7, 15).getTime(),
  total_ascent_meters: 320,
  max_speed_kmh: 48,
  start_lat: 22.54,
  start_lng: 114.05,
  summary_polyline: '',
};

function renderCard(ride: any, props: any = {}) {
  return render(
    <MemoryRouter>
      <RideCard ride={ride} {...props} />
    </MemoryRouter>
  );
}

describe('RideCard', () => {
  it('渲染标题、里程、均速、爬升、城市与日期', () => {
    renderCard(shenzhenRide);
    expect(screen.getByText('深圳湾公路骑行')).toBeInTheDocument();
    expect(screen.getByText('42.0')).toBeInTheDocument();
    expect(screen.getByText('深圳')).toBeInTheDocument();
    expect(screen.getByText('8月15日')).toBeInTheDocument();
    expect(screen.getByText('320m')).toBeInTheDocument();
  });

  it('公路标题渲染「公路」徽章', () => {
    renderCard({ ...shenzhenRide, title: '晨间公路刷圈' });
    expect(screen.getByText('公路')).toBeInTheDocument();
  });

  it('山地标题渲染「山地/骑行」徽章', () => {
    renderCard({ ...shenzhenRide, title: '郊野山地穿越' });
    expect(screen.getByText('山地/骑行')).toBeInTheDocument();
  });

  it('链接指向 /ride/{id}', () => {
    renderCard(shenzhenRide);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/ride/ride-1');
  });

  it('有 summary_polyline 时渲染轨迹 SVG', () => {
    renderCard({ ...shenzhenRide, summary_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' });
    expect(screen.getByLabelText('骑行路线缩略图')).toBeInTheDocument();
  });

  it('无 summary_polyline 时不渲染轨迹 SVG', () => {
    renderCard(shenzhenRide);
    expect(screen.queryByLabelText('骑行路线缩略图')).not.toBeInTheDocument();
  });

  it('触发 onMouseEnter / onMouseLeave 回调', async () => {
    const onMouseEnter = vi.fn();
    const onMouseLeave = vi.fn();
    const user = userEvent.setup();
    renderCard(shenzhenRide, { onMouseEnter, onMouseLeave });
    await user.hover(screen.getByRole('link'));
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    await user.unhover(screen.getByRole('link'));
    expect(onMouseLeave).toHaveBeenCalledTimes(1);
  });

  it('isHovered 时应用高亮边框样式', () => {
    const { container } = renderCard(shenzhenRide, { isHovered: true });
    expect(container.querySelector('a')).toHaveClass('border-blue-500');
  });
});

// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import DashboardControls from '../dashboard/DashboardControls';

/**
 * DashboardControls 仪表盘控件测试
 * 覆盖：搜索输入/清空、城市切换、底图样式菜单开合与切换、图例开关、Escape 关闭
 */

const cities = [
  { id: 'all', name: '全部城市', count: 5 },
  { id: '深圳', name: '深圳', count: 3 },
  { id: '杭州', name: '杭州', count: 2 },
];

function renderControls(overrides: any = {}) {
  const props = {
    searchTerm: '',
    onSearchChange: vi.fn(),
    availableCities: cities,
    selectedCity: 'all',
    onCitySelect: vi.fn(),
    currentMapStyle: 'light' as const,
    onMapStyleChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<DashboardControls {...props} />) };
}

describe('DashboardControls', () => {
  it('输入搜索词触发 onSearchChange', () => {
    const { props } = renderControls();
    fireEvent.change(screen.getByPlaceholderText('搜索路线名称与地点...'), {
      target: { value: '深圳湾' },
    });
    expect(props.onSearchChange).toHaveBeenCalledTimes(1);
    expect(props.onSearchChange).toHaveBeenCalledWith('深圳湾');
  });

  it('有搜索词时显示清空按钮，点击后回传空字符串', async () => {
    const user = userEvent.setup();
    const { props } = renderControls({ searchTerm: 'abc' });
    await user.click(screen.getByRole('button', { name: '清空搜索词' }));
    expect(props.onSearchChange).toHaveBeenCalledWith('');
  });

  it('无搜索词时不渲染清空按钮', () => {
    renderControls();
    expect(screen.queryByRole('button', { name: '清空搜索词' })).not.toBeInTheDocument();
  });

  it('渲染城市胶囊并高亮选中项，点击触发 onCitySelect', async () => {
    const user = userEvent.setup();
    const { props } = renderControls();
    expect(screen.getByText('全部城市')).toBeInTheDocument();
    expect(screen.getByText('深圳')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /深圳/ }));
    expect(props.onCitySelect).toHaveBeenCalledWith('深圳');
  });

  it('底图样式菜单：展开、选择后回调并关闭', async () => {
    const user = userEvent.setup();
    const { props } = renderControls();
    await user.click(screen.getByRole('button', { name: /常规地图/ }));
    expect(screen.getByText('卫星地图')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /卫星地图/ }));
    expect(props.onMapStyleChange).toHaveBeenCalledWith('satellite');
    expect(screen.queryByText('卫星地图')).not.toBeInTheDocument();
  });

  it('图例开关展开与收起', async () => {
    const user = userEvent.setup();
    renderControls();
    await user.click(screen.getByTitle('速度图例'));
    expect(screen.getByText('动力学速度谱系')).toBeInTheDocument();
    await user.click(screen.getByTitle('速度图例'));
    expect(screen.queryByText('动力学速度谱系')).not.toBeInTheDocument();
  });

  it('按 Escape 关闭已展开的图例', async () => {
    const user = userEvent.setup();
    renderControls();
    await user.click(screen.getByTitle('速度图例'));
    expect(screen.getByText('动力学速度谱系')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('动力学速度谱系')).not.toBeInTheDocument();
  });
});

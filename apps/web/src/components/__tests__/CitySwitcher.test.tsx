// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import CitySwitcher from '../dashboard/CitySwitcher';

const fewCities = [
  { id: 'all', name: '全部城市', count: 5 },
  { id: '深圳', name: '深圳', count: 3 },
  { id: '杭州', name: '杭州', count: 2 },
];

const manyCities = [
  { id: 'all', name: '全部城市', count: 10 },
  { id: '深圳', name: '深圳', count: 4 },
  { id: '杭州', name: '杭州', count: 2 },
  { id: '广州', name: '广州', count: 2 },
  { id: '上海', name: '上海', count: 1 },
  { id: '北京', name: '北京', count: 1 },
];

describe('CitySwitcher 城市切换组件', () => {
  it('当城市少于等于5个时，全部作为主按钮渲染，不展示更多城市下拉', () => {
    const onSelect = vi.fn();
    render(
      <CitySwitcher
        availableCities={fewCities}
        selectedCity="all"
        onCitySelect={onSelect}
      />
    );

    expect(screen.getByText('全部城市')).toBeInTheDocument();
    expect(screen.getByText('深圳')).toBeInTheDocument();
    expect(screen.getByText('杭州')).toBeInTheDocument();
    expect(screen.queryByTitle('更多骑行城市')).not.toBeInTheDocument();
  });

  it('点击城市按钮触发 onCitySelect 回调', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <CitySwitcher
        availableCities={fewCities}
        selectedCity="all"
        onCitySelect={onSelect}
      />
    );

    await user.click(screen.getByRole('button', { name: /深圳/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('深圳');
  });

  it('当城市多于5个时，自适应收折并可通过更多城市下拉切换', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <CitySwitcher
        availableCities={manyCities}
        selectedCity="all"
        onCitySelect={onSelect}
      />
    );

    const moreBtn = screen.getByTitle('更多骑行城市');
    expect(moreBtn).toBeInTheDocument();

    // 点击打开下拉
    await user.click(moreBtn);
    expect(screen.getByText('上海')).toBeInTheDocument();
    expect(screen.getByText('北京')).toBeInTheDocument();

    // 点击下拉中的城市
    await user.click(screen.getByRole('button', { name: /上海/ }));
    expect(onSelect).toHaveBeenCalledWith('上海');
  });
});

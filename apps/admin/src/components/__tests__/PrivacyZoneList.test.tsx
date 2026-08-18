// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrivacyZoneList } from '../PrivacyZoneList';
import type { PrivacyZone } from '../../utils/privacyScrubber';

// 构造两条隐私区域样例
const zones: PrivacyZone[] = [
  { id: 'z1', name: '家', latitude: 30.12345, longitude: 120.56789, radius_meters: 200 },
  { id: 'z2', name: '公司', latitude: 31.98765, longitude: 121.4321, radius_meters: 500 },
];

describe('PrivacyZoneList 隐私区域列表组件', () => {
  const onToggleZone = vi.fn();

  beforeEach(() => {
    onToggleZone.mockClear();
  });

  it('无区域时显示空状态与已激活 0 个', () => {
    render(
      <PrivacyZoneList
        zones={[]}
        activeZoneIds={new Set()}
        onToggleZone={onToggleZone}
      />
    );
    expect(screen.getByText('暂无配置隐私脱敏区域')).toBeInTheDocument();
    expect(screen.getByText('已激活 0 个区域')).toBeInTheDocument();
  });

  it('渲染区域名称、坐标与保护半径', () => {
    render(
      <PrivacyZoneList
        zones={zones}
        activeZoneIds={new Set()}
        onToggleZone={onToggleZone}
      />
    );
    expect(screen.getByText('家')).toBeInTheDocument();
    expect(screen.getByText('公司')).toBeInTheDocument();
    // 坐标保留 4 位小数。JSX 会把 {lat}°, {lng}° 拆成多个文本节点，
    // 且浮点 toFixed 存在取整差异，故用函数匹配器比对 span 整体 textContent。
    const coordText = (lat: number, lng: number) => `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
    expect(
      screen.getByText((_, el) => el?.textContent === coordText(30.12345, 120.56789))
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, el) => el?.textContent === coordText(31.98765, 121.4321))
    ).toBeInTheDocument();
    expect(screen.getByText('200米 保护半径')).toBeInTheDocument();
    expect(screen.getByText('500米 保护半径')).toBeInTheDocument();
  });

  it('已激活数量徽标反映 activeZoneIds 大小', () => {
    render(
      <PrivacyZoneList
        zones={zones}
        activeZoneIds={new Set(['z1', 'z2'])}
        onToggleZone={onToggleZone}
      />
    );
    expect(screen.getByText('已激活 2 个区域')).toBeInTheDocument();
  });

  it('点击开关时调用 onToggleZone 并传入对应区域 id', () => {
    render(
      <PrivacyZoneList
        zones={zones}
        activeZoneIds={new Set(['z1'])}
        onToggleZone={onToggleZone}
      />
    );
    // 公司（z2）当前为停用状态
    fireEvent.click(screen.getByRole('button', { name: '点击启用该隐私脱敏区' }));
    expect(onToggleZone).toHaveBeenCalledTimes(1);
    expect(onToggleZone).toHaveBeenCalledWith('z2');

    // 家（z1）当前为激活状态
    fireEvent.click(screen.getByRole('button', { name: '点击停用该隐私脱敏区' }));
    expect(onToggleZone).toHaveBeenCalledTimes(2);
    expect(onToggleZone).toHaveBeenLastCalledWith('z1');
  });

  it('激活与停用区域展示不同样式与按钮提示', () => {
    render(
      <PrivacyZoneList
        zones={zones}
        activeZoneIds={new Set(['z1'])}
        onToggleZone={onToggleZone}
      />
    );
    // 激活态：蓝色背景 + “点击停用”提示
    const activeBtn = screen.getByRole('button', { name: '点击停用该隐私脱敏区' });
    expect(activeBtn.className).toContain('bg-blue-600');
    // 停用态：灰色背景 + “点击启用”提示
    const inactiveBtn = screen.getByRole('button', { name: '点击启用该隐私脱敏区' });
    expect(inactiveBtn.className).toContain('bg-slate-300');
  });
});

// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ManualProfileTab from '../profile/ManualProfileTab';
import type { RiderProfile } from '../../types/rider';

/**
 * ManualProfileTab 手动档案编辑表单组件测试。
 * 覆盖：各字段渲染、字段编辑回调 onChange、自定义字段添加/删除、空值禁用。
 */
describe('ManualProfileTab 手动档案编辑', () => {
  const makeProfile = (overrides: Partial<RiderProfile> = {}): RiderProfile => ({
    name: 'VerNe',
    gender: 'male',
    weight_kg: 75,
    height_cm: 173,
    max_hr: 188,
    resting_hr: 55,
    ftp_watts: 165,
    current_bike: '大行 P8',
    gear_ratio: '46T牙盘 + 11-28T 7速飞轮',
    tires: '马牌 Contact Urban 2.0 轮胎',
    bike_specs: '',
    custom_specs: '{"pedals": "平踏", "wheelset": "20寸406"}',
    injuries_notes: '右膝轻微劳损',
    primary_goal: '巡航 20km/h',
    ...overrides,
  });

  const renderTab = (onChange = vi.fn()) => {
    const initialProfile = makeProfile();
    // 受控表单：父级用 useState 维护 profile，保证 userEvent 逐字符输入时 value 同步更新
    const Wrapper = () => {
      const [profile, setProfile] = React.useState(initialProfile);
      return (
        <ManualProfileTab
          profile={profile}
          onChange={(updated) => {
            setProfile(updated);
            onChange(updated);
          }}
        />
      );
    };
    render(<Wrapper />);
    return { onChange, profile: initialProfile };
  };

  it('渲染档案各字段值', () => {
    renderTab();
    // 表单的 label 未通过 htmlFor/id 与输入框关联，改用 getByDisplayValue 定位
    expect(screen.getByDisplayValue('VerNe')).toHaveValue('VerNe');
    expect(screen.getByDisplayValue('75')).toHaveValue(75);
    expect(screen.getByDisplayValue('188')).toHaveValue(188);
    expect(screen.getByDisplayValue('大行 P8')).toHaveValue('大行 P8');
    expect(screen.getByDisplayValue('46T牙盘 + 11-28T 7速飞轮')).toHaveValue('46T牙盘 + 11-28T 7速飞轮');
    expect(screen.getByDisplayValue('马牌 Contact Urban 2.0 轮胎')).toHaveValue('马牌 Contact Urban 2.0 轮胎');
    expect(screen.getByDisplayValue('右膝轻微劳损')).toHaveValue('右膝轻微劳损');
    expect(screen.getByDisplayValue('巡航 20km/h')).toHaveValue('巡航 20km/h');
  });

  it('编辑昵称调用 onChange 生成新档案对象', async () => {
    const user = userEvent.setup();
    const { onChange, profile } = renderTab();
    const nameInput = screen.getByDisplayValue('VerNe');
    await user.clear(nameInput);
    await user.type(nameInput, '新昵称');
    expect(onChange).toHaveBeenLastCalledWith({ ...profile, name: '新昵称' });
  });

  it('编辑体重调用 onChange 并解析为数字', async () => {
    const user = userEvent.setup();
    const { onChange, profile } = renderTab();
    const weightInput = screen.getByDisplayValue('75');
    await user.clear(weightInput);
    await user.type(weightInput, '72');
    expect(onChange).toHaveBeenLastCalledWith({ ...profile, weight_kg: 72 });
  });

  it('解析 custom_specs 字符串并渲染自定义字段徽标', () => {
    renderTab();
    expect(screen.getByText('pedals:')).toBeInTheDocument();
    expect(screen.getByText('平踏')).toBeInTheDocument();
    expect(screen.getByText('wheelset:')).toBeInTheDocument();
    expect(screen.getByText('20寸406')).toBeInTheDocument();
  });

  it('删除自定义字段调用 onChange 移除对应键', async () => {
    const user = userEvent.setup();
    const { onChange, profile } = renderTab();
    await user.click(screen.getByLabelText('删除 pedals'));
    expect(onChange).toHaveBeenCalledWith({
      ...profile,
      custom_specs: { wheelset: '20寸406' },
    });
  });

  it('添加自定义字段调用 onChange 并清空输入', async () => {
    const user = userEvent.setup();
    const { onChange, profile } = renderTab();
    await user.type(screen.getByPlaceholderText('属性名(如: 脚踏/轮组/码表)'), '码表');
    await user.type(screen.getByPlaceholderText('属性值(如: 平踏/20寸406/迈金C406)'), '迈金C406');
    await user.click(screen.getByRole('button', { name: '添加' }));

    expect(onChange).toHaveBeenLastCalledWith({
      ...profile,
      custom_specs: { pedals: '平踏', wheelset: '20寸406', 码表: '迈金C406' },
    });
    // 输入清空
    expect(screen.getByPlaceholderText('属性名(如: 脚踏/轮组/码表)')).toHaveValue('');
    expect(screen.getByPlaceholderText('属性值(如: 平踏/20寸406/迈金C406)')).toHaveValue('');
  });

  it('键或值为空时添加按钮禁用', () => {
    renderTab();
    expect(screen.getByRole('button', { name: '添加' })).toBeDisabled();
  });
});

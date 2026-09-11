// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AIGatewayConfigTab from '../profile/AIGatewayConfigTab';

// mock aiClient：组件测试只验证 UI 与交互，不耦合到真实 Gateway 调用
vi.mock('../../services/aiClient', () => ({
  getGatewayKey: vi.fn(() => 'stored-key'),
  setGatewayKey: vi.fn(),
  getAIConfig: vi.fn(),
  updateAIConfig: vi.fn(),
  testGatewayConnection: vi.fn(),
}));

import {
  getGatewayKey,
  setGatewayKey,
  getAIConfig,
  updateAIConfig,
  testGatewayConnection,
} from '../../services/aiClient';

const jsonOk = (data: unknown) =>
  ({ ok: true, status: 200, json: async () => data }) as any;

/**
 * AIGatewayConfigTab AI 接入配置 Tab 测试。
 * 覆盖：挂载回填、保存 URL/模型到后端、保存 key 到 localStorage、
 * 测试连通（成功/失败/模型不在列表）、错误展示。
 */
describe('AIGatewayConfigTab AI 接入配置', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('挂载时从后端拉配置回填 + 读 localStorage 的 key', async () => {
    (getAIConfig as any).mockResolvedValue({ base_url: 'https://gw.example.com', model_name: 'glm-5.2' });
    (getGatewayKey as any).mockReturnValue('stored-key');

    render(<AIGatewayConfigTab />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://gw.example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('glm-5.2')).toBeInTheDocument();
    });
    expect(getAIConfig).toHaveBeenCalledTimes(1);
    expect(getGatewayKey).toHaveBeenCalled();
  });

  it('保存 URL 与模型：调 updateAIConfig 并显示已保存', async () => {
    (getAIConfig as any).mockResolvedValue({ base_url: '', model_name: 'glm-5.2' });
    (updateAIConfig as any).mockResolvedValue(undefined);

    render(<AIGatewayConfigTab />);
    await waitFor(() => expect(screen.getByPlaceholderText('glm-5.2')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('https://api-gateway.yuuverne.site'), {
      target: { value: 'https://gw.example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('glm-5.2'), {
      target: { value: 'deepseek-v4-flash' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存 URL 与模型到后端|保存中/ }));

    await waitFor(() => {
      expect(updateAIConfig).toHaveBeenCalledWith({
        base_url: 'https://gw.example.com',
        model_name: 'deepseek-v4-flash',
      });
      expect(screen.getByText('已保存到后端')).toBeInTheDocument();
    });
  });

  it('保存 key：写 localStorage 并提示已保存', async () => {
    (getAIConfig as any).mockResolvedValue({ base_url: '', model_name: 'glm-5.2' });
    (setGatewayKey as any).mockImplementation(() => {});

    render(<AIGatewayConfigTab />);
    await waitFor(() => expect(screen.getByPlaceholderText('sk-...')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('sk-...'), { target: { value: 'new-key-123' } });
    fireEvent.click(screen.getByRole('button', { name: '保存到本机' }));

    expect(setGatewayKey).toHaveBeenCalledWith('new-key-123');
    expect(screen.getByText('已保存到后端')).toBeInTheDocument();
  });

  it('测试连通成功且模型在列表中', async () => {
    (getAIConfig as any).mockResolvedValue({ base_url: 'https://gw.example.com', model_name: 'glm-5.2' });
    (testGatewayConnection as any).mockResolvedValue(['glm-5.2', 'deepseek-v4-flash']);

    render(<AIGatewayConfigTab />);
    await waitFor(() => expect(screen.getByRole('button', { name: /测试连通/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /测试连通/ }));

    await waitFor(() => {
      expect(testGatewayConnection).toHaveBeenCalled();
      expect(screen.getByText(/连通正常/)).toBeInTheDocument();
    });
  });

  it('测试连通成功但模型不在列表：报错并提示', async () => {
    (getAIConfig as any).mockResolvedValue({ base_url: 'https://gw.example.com', model_name: 'wrong-model' });
    (testGatewayConnection as any).mockResolvedValue(['glm-5.2', 'deepseek-v4-flash']);

    render(<AIGatewayConfigTab />);
    await waitFor(() => expect(screen.getByRole('button', { name: /测试连通/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /测试连通/ }));

    await waitFor(() => {
      expect(screen.getByText(/不在可用列表/)).toBeInTheDocument();
    });
  });

  it('测试连通失败（key 无效 401）：展示错误', async () => {
    (getAIConfig as any).mockResolvedValue({ base_url: 'https://gw.example.com', model_name: 'glm-5.2' });
    (testGatewayConnection as any).mockRejectedValue(new Error('Gateway 拒绝鉴权（HTTP 401）：key 无效或无权限'));

    render(<AIGatewayConfigTab />);
    await waitFor(() => expect(screen.getByRole('button', { name: /测试连通/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /测试连通/ }));

    await waitFor(() => {
      expect(screen.getByText(/Gateway 拒绝鉴权/)).toBeInTheDocument();
    });
  });

  it('可用模型芯片可点击切换 model_name', async () => {
    (getAIConfig as any).mockResolvedValue({ base_url: '', model_name: 'glm-5.2' });
    (testGatewayConnection as any).mockResolvedValue(['glm-5.2', 'deepseek-v4-flash']);

    render(<AIGatewayConfigTab />);
    await waitFor(() => expect(screen.getByRole('button', { name: /测试连通/ })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /测试连通/ }));

    // 模型芯片出现
    const dsBtn = await screen.findByText('deepseek-v4-flash');
    fireEvent.click(dsBtn);
    expect(screen.getByDisplayValue('deepseek-v4-flash')).toBeInTheDocument();
  });
});

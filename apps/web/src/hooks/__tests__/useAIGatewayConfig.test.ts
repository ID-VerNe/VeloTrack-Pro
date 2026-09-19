import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAIGatewayConfig } from '../useAIGatewayConfig';
import * as aiClient from '../../services/aiClient';
import * as adminApiClient from '../../utils/activity/adminApiClient';

vi.mock('../../services/aiClient', () => ({
  getGatewayKey: vi.fn(),
  setGatewayKey: vi.fn(),
  getAIConfig: vi.fn(),
  updateAIConfig: vi.fn(),
  testGatewayConnection: vi.fn(),
}));

vi.mock('../../utils/activity/adminApiClient', () => ({
  getAdminToken: vi.fn(),
  setAdminToken: vi.fn(),
}));

describe('useAIGatewayConfig AI 网关配置状态机 Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(aiClient.getGatewayKey).mockReturnValue('sk-initial-key');
    vi.mocked(aiClient.getAIConfig).mockResolvedValue({
      base_url: 'https://api.example.com/v1',
      model_name: 'glm-5.2',
    });
    vi.mocked(adminApiClient.getAdminToken).mockReturnValue('admin-secret');
  });

  it('初始挂载正确加载远端配置与本地凭据', async () => {
    const { result } = renderHook(() => useAIGatewayConfig());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.baseUrl).toBe('https://api.example.com/v1');
    expect(result.current.modelName).toBe('glm-5.2');
    expect(result.current.apiKey).toBe('sk-initial-key');
    expect(result.current.adminToken).toBe('admin-secret');
  });

  it('保存管理令牌触发 setAdminToken 并置 saved 标志', () => {
    const { result } = renderHook(() => useAIGatewayConfig());

    act(() => {
      result.current.setAdminTokenState('new-token');
    });

    act(() => {
      result.current.handleSaveAdminToken();
    });

    expect(adminApiClient.setAdminToken).toHaveBeenCalledWith('new-token');
    expect(result.current.adminTokenSaved).toBe(true);
  });

  it('测试连通性成功并返回可用模型列表', async () => {
    vi.mocked(aiClient.testGatewayConnection).mockResolvedValue(['glm-5.2', 'glm-4-plus']);

    const { result } = renderHook(() => useAIGatewayConfig());

    await act(async () => {
      await result.current.handleTestConnection();
    });

    expect(result.current.testStatus).toBe('success');
    expect(result.current.availableModels).toEqual(['glm-5.2', 'glm-4-plus']);
    expect(result.current.testMessage).toContain('连通正常');
  });
});

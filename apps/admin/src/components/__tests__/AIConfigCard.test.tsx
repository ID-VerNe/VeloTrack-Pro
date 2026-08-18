// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AIConfigCard } from '../AIConfigCard';

// 构造形如 fetch 响应（含 json 方法）的 mock 返回值
const jsonResponse = (data: unknown) => ({
  ok: true,
  status: 200,
  json: async () => data,
});

describe('AIConfigCard AI 配置卡片组件', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 点击手风琴头部展开/收起面板
  const toggleHeader = () =>
    fireEvent.click(screen.getByRole('button', { name: /语言模型与分析服务配置/ }));

  it('默认折叠：仅显示标题与描述，不渲染表单输入框', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    render(<AIConfigCard />);
    expect(screen.getByText('语言模型与分析服务配置')).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('http://localhost:37183/v1')
    ).not.toBeInTheDocument();
  });

  it('挂载时 GET /api/ai/config 拉取配置并回填表单', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      jsonResponse({
        config: {
          base_url: 'https://api.example.com/v1',
          model_name: 'gpt-4o',
          api_key: 'sk-***abcd',
        },
      })
    );
    vi.stubGlobal('fetch', mockFetch);
    render(<AIConfigCard />);
    toggleHeader();

    expect(
      await screen.findByDisplayValue('https://api.example.com/v1')
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('gpt-4o')).toBeInTheDocument();
    expect(screen.getByDisplayValue('sk-***abcd')).toBeInTheDocument();
    expect(mockFetch.mock.calls[0][0]).toBe('/api/ai/config');
  });

  it('点击头部可在展开与收起间切换', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    render(<AIConfigCard />);
    toggleHeader();
    expect(
      screen.getByPlaceholderText('http://localhost:37183/v1')
    ).toBeInTheDocument();
    toggleHeader();
    expect(
      screen.queryByPlaceholderText('http://localhost:37183/v1')
    ).not.toBeInTheDocument();
  });

  it('base_url / model_name / api_key 三个输入框可编辑', () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    render(<AIConfigCard />);
    toggleHeader();

    const baseInput = screen.getByPlaceholderText('http://localhost:37183/v1');
    fireEvent.change(baseInput, { target: { value: 'https://new.example.com/v1' } });
    expect(baseInput).toHaveValue('https://new.example.com/v1');

    const modelInput = screen.getByPlaceholderText('deepseek-v4-flash');
    fireEvent.change(modelInput, { target: { value: 'gpt-5' } });
    expect(modelInput).toHaveValue('gpt-5');

    const keyInput = screen.getByPlaceholderText('sk-...');
    fireEvent.change(keyInput, { target: { value: 'sk-test-key' } });
    expect(keyInput).toHaveValue('sk-test-key');
  });

  it('测试连接成功：POST /api/ai/test-connection 并展示延迟与模型', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(
        jsonResponse({ success: true, latencyMs: 120, model: 'deepseek-v4-flash' })
      );
    vi.stubGlobal('fetch', mockFetch);
    render(<AIConfigCard />);
    toggleHeader();
    fireEvent.click(screen.getByRole('button', { name: /测试连接/ }));

    expect(
      await screen.findByText('连通正常 (120ms · deepseek-v4-flash)')
    ).toBeInTheDocument();

    const postCall = mockFetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(postCall).toBeTruthy();
    expect(postCall![0]).toBe('/api/ai/test-connection');
    expect(JSON.parse((postCall![1] as RequestInit).body as string)).toEqual({
      base_url: '',
      model_name: 'deepseek-v4-flash',
    });
  });

  it('测试连接后端返回失败时展示 error 文案', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ success: false, error: 'API Key 无效' }));
    vi.stubGlobal('fetch', mockFetch);
    render(<AIConfigCard />);
    toggleHeader();
    fireEvent.click(screen.getByRole('button', { name: /测试连接/ }));

    expect(await screen.findByText('API Key 无效')).toBeInTheDocument();
  });

  it('测试连接网络异常时展示错误信息', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockRejectedValueOnce(new Error('网络连接异常'));
    vi.stubGlobal('fetch', mockFetch);
    render(<AIConfigCard />);
    toggleHeader();
    fireEvent.click(screen.getByRole('button', { name: /测试连接/ }));

    expect(await screen.findByText('网络连接异常')).toBeInTheDocument();
  });

  it('测试连接中按钮进入禁用（loading）状态，完成后恢复', async () => {
    let resolveTest!: (v: unknown) => void;
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockImplementationOnce(() => new Promise((res) => (resolveTest = res)));
    vi.stubGlobal('fetch', mockFetch);
    render(<AIConfigCard />);
    toggleHeader();

    const testBtn = screen.getByRole('button', { name: /测试连接/ });
    fireEvent.click(testBtn);
    // fetch 尚未 resolve，按钮应处于禁用状态
    expect(testBtn).toBeDisabled();

    await act(async () => {
      resolveTest(jsonResponse({ success: true, latencyMs: 10, model: 'deepseek-v4-flash' }));
    });
    expect(await screen.findByText(/连通正常/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /测试连接/ })).toBeEnabled();
  });

  it('保存配置成功：PUT 携带表单数据并显示“已保存”', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);
    render(<AIConfigCard />);
    toggleHeader();

    fireEvent.change(screen.getByPlaceholderText('http://localhost:37183/v1'), {
      target: { value: 'https://a.com/v1' },
    });
    fireEvent.change(screen.getByPlaceholderText('deepseek-v4-flash'), {
      target: { value: 'gpt-4o-mini' },
    });
    fireEvent.change(screen.getByPlaceholderText('sk-...'), {
      target: { value: 'sk-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: /保存配置/ }));

    expect(await screen.findByText('已保存')).toBeInTheDocument();

    const putCall = mockFetch.mock.calls.find(([, init]) => init?.method === 'PUT');
    expect(putCall).toBeTruthy();
    expect(putCall![0]).toBe('/api/ai/config');
    expect(JSON.parse((putCall![1] as RequestInit).body as string)).toEqual({
      base_url: 'https://a.com/v1',
      model_name: 'gpt-4o-mini',
      api_key: 'sk-secret',
    });
  });

  it('保存配置失败（HTTP 500）时展示错误提示', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: '服务器内部错误' }),
      });
    vi.stubGlobal('fetch', mockFetch);
    render(<AIConfigCard />);
    toggleHeader();
    fireEvent.click(screen.getByRole('button', { name: /保存配置/ }));

    expect(await screen.findByText('保存失败：服务器内部错误')).toBeInTheDocument();
  });

  it('保存成功后 2.5 秒自动恢复按钮文案', async () => {
    vi.useFakeTimers();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);
    render(<AIConfigCard />);
    toggleHeader();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /保存配置/ }));
    });
    expect(screen.getByText('已保存')).toBeInTheDocument();

    // 推进 2.5s 后应恢复为“保存配置”
    await act(async () => {
      vi.advanceTimersByTime(2500);
    });
    expect(screen.getByRole('button', { name: /保存配置/ })).toBeInTheDocument();
    vi.useRealTimers();
  });
});

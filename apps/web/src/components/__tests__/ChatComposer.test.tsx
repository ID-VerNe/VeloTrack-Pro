// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatComposer from '../chat/ChatComposer';

/**
 * ChatComposer 消息输入框组件测试。
 * 覆盖：渲染结构、输入回调、发送按钮/回车发送、disabled 状态。
 * 注意：每次测试都新建 mock，避免跨用例共享调用记录。
 */
describe('ChatComposer 消息输入框', () => {
  const makeProps = (overrides: Partial<React.ComponentProps<typeof ChatComposer>> = {}) => ({
    input: '',
    isLoading: false,
    suggestedPrompts: ['提示A', '提示B'],
    onInputChange: vi.fn(),
    onSend: vi.fn(),
    ...overrides,
  });

  it('渲染文本域、快捷提示芯片与发送按钮', () => {
    render(<ChatComposer {...makeProps()} />);
    expect(screen.getByPlaceholderText(/输入训练诉求/)).toBeInTheDocument();
    expect(screen.getByText('提示A')).toBeInTheDocument();
    expect(screen.getByText('提示B')).toBeInTheDocument();
    expect(screen.getByText('推演执行')).toBeInTheDocument();
  });

  it('输入内容时逐字符回调 onInputChange，最终携带完整值', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    // 受控组件需要真实更新 input state，否则 userEvent 对未更新的受控输入会异常
    const Wrapper = () => {
      const [input, setInput] = React.useState('');
      return (
        <ChatComposer
          {...props}
          input={input}
          onInputChange={(v) => {
            setInput(v);
            props.onInputChange(v);
          }}
        />
      );
    };
    render(<Wrapper />);
    const textarea = screen.getByPlaceholderText(/输入训练诉求/);
    await user.type(textarea, '今天练踏频');
    expect(props.onInputChange).toHaveBeenCalledTimes('今天练踏频'.length);
    expect(props.onInputChange).toHaveBeenLastCalledWith('今天练踏频');
  });

  it('点击发送按钮调用 onSend', async () => {
    const user = userEvent.setup();
    const props = makeProps({ input: '内容' });
    render(<ChatComposer {...props} />);
    await user.click(screen.getByRole('button', { name: '推演执行' }));
    expect(props.onSend).toHaveBeenCalledTimes(1);
  });

  it('输入为空时发送按钮禁用', () => {
    render(<ChatComposer {...makeProps({ input: '' })} />);
    expect(screen.getByRole('button', { name: '推演执行' })).toBeDisabled();
  });

  it('输入为纯空白时发送按钮禁用', () => {
    render(<ChatComposer {...makeProps({ input: '   ' })} />);
    expect(screen.getByRole('button', { name: '推演执行' })).toBeDisabled();
  });

  it('isLoading 时文本域、发送按钮与快捷提示均禁用', () => {
    render(<ChatComposer {...makeProps({ input: '内容', isLoading: true })} />);
    expect(screen.getByPlaceholderText(/输入训练诉求/)).toBeDisabled();
    expect(screen.getByRole('button', { name: '推演执行' })).toBeDisabled();
    expect(screen.getByText('提示A')).toBeDisabled();
  });

  it('按 Enter 触发发送（不带参数）', async () => {
    const user = userEvent.setup();
    const props = makeProps({ input: '内容' });
    render(<ChatComposer {...props} />);
    const textarea = screen.getByPlaceholderText(/输入训练诉求/);
    await user.type(textarea, '{Enter}');
    expect(props.onSend).toHaveBeenCalledTimes(1);
    expect(props.onSend).toHaveBeenCalledWith();
  });

  it('Shift + Enter 不触发发送（换行）', async () => {
    const user = userEvent.setup();
    const props = makeProps({ input: '内容' });
    render(<ChatComposer {...props} />);
    const textarea = screen.getByPlaceholderText(/输入训练诉求/);
    await user.click(textarea);
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('isLoading 时点击快捷提示不触发发送', async () => {
    const user = userEvent.setup();
    const props = makeProps({ isLoading: true });
    render(<ChatComposer {...props} />);
    await user.click(screen.getByText('提示A'));
    expect(props.onSend).not.toHaveBeenCalled();
  });

  it('点击快捷提示直接以提示文本调用 onSend', async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<ChatComposer {...props} />);
    await user.click(screen.getByText('提示B'));
    expect(props.onSend).toHaveBeenCalledWith('提示B');
  });
});

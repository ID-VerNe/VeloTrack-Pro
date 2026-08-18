// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import IconButton from '../common/IconButton';

/**
 * IconButton 统一图标按钮测试
 * 覆盖：无障碍标签、尺寸档位、危险样式、点击回调、禁用态与 className 透传
 */

describe('IconButton', () => {
  it('渲染按钮并带有必填的 aria-label 与 title', () => {
    render(<IconButton label="删除路线">x</IconButton>);
    const btn = screen.getByRole('button', { name: '删除路线' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('title', '删除路线');
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('默认使用 md 尺寸 (h-9 w-9)', () => {
    render(<IconButton label="测试">x</IconButton>);
    expect(screen.getByRole('button')).toHaveClass('h-9', 'w-9');
  });

  it.each([
    ['xs', 'h-6', 'w-6'],
    ['sm', 'h-8', 'w-8'],
    ['lg', 'h-11', 'w-11'],
  ] as const)('size=%s 应用对应尺寸类 %s/%s', (size, h, w) => {
    render(
      <IconButton label="测试" size={size}>
        x
      </IconButton>
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass(h, w);
  });

  it('danger 模式追加 hover:text-rose-600 危险样式', () => {
    render(
      <IconButton label="删除" danger>
        x
      </IconButton>
    );
    expect(screen.getByRole('button')).toHaveClass('hover:text-rose-600');
  });

  it('点击触发 onClick 回调', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <IconButton label="点击" onClick={onClick}>
        x
      </IconButton>
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled 时不可点击且应用禁用样式', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <IconButton label="禁用" onClick={onClick} disabled>
        x
      </IconButton>
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveClass('disabled:opacity-40');
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('透传自定义 className 与 children 内容', () => {
    render(
      <IconButton label="自定义" className="custom-cls">
        ✨
      </IconButton>
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('custom-cls');
    expect(btn.textContent).toBe('✨');
  });
});

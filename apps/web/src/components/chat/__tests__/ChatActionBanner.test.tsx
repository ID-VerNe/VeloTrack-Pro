import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChatActionBanner from '../ChatActionBanner';

describe('ChatActionBanner', () => {
  it('renders goal action banner correctly with link to goals', () => {
    render(
      <MemoryRouter>
        <ChatActionBanner actionType="goal" />
      </MemoryRouter>
    );

    expect(screen.getByText('阶段训练目标与量化指标已写入生效')).toBeInTheDocument();
    expect(screen.getByText('查看目标进度')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /查看目标进度/ });
    expect(link).toHaveAttribute('href', '/goals');
  });

  it('renders profile action banner and triggers onOpenProfile', () => {
    const onOpenProfile = vi.fn();
    render(
      <MemoryRouter>
        <ChatActionBanner actionType="profile" onOpenProfile={onOpenProfile} />
      </MemoryRouter>
    );

    expect(screen.getByText('战车硬件参数与传动规格已成功更新')).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /查看档案/ });
    fireEvent.click(btn);
    expect(onOpenProfile).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when actionType is none', () => {
    const { container } = render(
      <MemoryRouter>
        <ChatActionBanner actionType="none" />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MemoryItemCard from '../MemoryItemCard';
import type { RiderMemory } from '../../../types/rider';

describe('MemoryItemCard', () => {
  const mockMemory: RiderMemory = {
    id: 101,
    category: 'health',
    memory_key: 'test_knee',
    content: '需维持85-95rpm踏频防护膝盖',
    source: 'coach',
    created_at: 1700000000,
  };

  it('renders memory details properly', () => {
    render(
      <MemoryItemCard
        memory={mockMemory}
        isConfirmingDelete={false}
        onRequestDelete={vi.fn()}
        onConfirmDelete={vi.fn()}
        onCancelDelete={vi.fn()}
      />
    );

    expect(screen.getByText('需维持85-95rpm踏频防护膝盖')).toBeInTheDocument();
    expect(screen.getByText('身体底线')).toBeInTheDocument();
    expect(screen.getByText('实战沟通沉淀')).toBeInTheDocument();
  });

  it('handles delete request click', () => {
    const onRequestDelete = vi.fn();
    render(
      <MemoryItemCard
        memory={mockMemory}
        isConfirmingDelete={false}
        onRequestDelete={onRequestDelete}
        onConfirmDelete={vi.fn()}
        onCancelDelete={vi.fn()}
      />
    );

    const deleteBtn = screen.getByTitle('删除该条备忘');
    fireEvent.click(deleteBtn);
    expect(onRequestDelete).toHaveBeenCalledWith(101);
  });

  it('renders confirmation mode and handles confirm and cancel', () => {
    const onConfirmDelete = vi.fn();
    const onCancelDelete = vi.fn();

    render(
      <MemoryItemCard
        memory={mockMemory}
        isConfirmingDelete={true}
        onRequestDelete={vi.fn()}
        onConfirmDelete={onConfirmDelete}
        onCancelDelete={onCancelDelete}
      />
    );

    expect(screen.getByText('确认')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();

    fireEvent.click(screen.getByText('确认'));
    expect(onConfirmDelete).toHaveBeenCalledWith(101);

    fireEvent.click(screen.getByText('取消'));
    expect(onCancelDelete).toHaveBeenCalled();
  });
});

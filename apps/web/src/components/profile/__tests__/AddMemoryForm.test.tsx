import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddMemoryForm from '../AddMemoryForm';

describe('AddMemoryForm', () => {
  it('renders correctly with disabled submit button initially', () => {
    render(<AddMemoryForm onAddMemory={vi.fn()} />);

    expect(screen.getByPlaceholderText(/例如：右膝曾有劳损/)).toBeInTheDocument();
    const submitBtn = screen.getByRole('button', { name: '添加' });
    expect(submitBtn).toBeDisabled();
  });

  it('enables button when text is entered and triggers onAddMemory', async () => {
    const onAddMemory = vi.fn().mockResolvedValue(undefined);
    render(<AddMemoryForm onAddMemory={onAddMemory} />);

    const input = screen.getByPlaceholderText(/例如：右膝曾有劳损/);
    const select = screen.getByRole('combobox');
    const submitBtn = screen.getByRole('button', { name: '添加' });

    fireEvent.change(select, { target: { value: 'gear' } });
    fireEvent.change(input, { target: { value: '使用20寸406轮组' } });

    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onAddMemory).toHaveBeenCalledWith('gear', '使用20寸406轮组');
      expect(input).toHaveValue('');
    });
  });
});

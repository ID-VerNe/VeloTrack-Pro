import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CustomSpecsEditor from '../profile/CustomSpecsEditor';

describe('CustomSpecsEditor', () => {
  it('renders existing specs from JSON string or object', () => {
    render(
      <CustomSpecsEditor
        customSpecs='{"脚踏":"平踏","轮组":"20寸406"}'
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('脚踏:')).toBeInTheDocument();
    expect(screen.getByText('平踏')).toBeInTheDocument();
    expect(screen.getByText('轮组:')).toBeInTheDocument();
    expect(screen.getByText('20寸406')).toBeInTheDocument();
  });

  it('adds a new spec and calls onChange', () => {
    const onChange = vi.fn();
    render(
      <CustomSpecsEditor
        customSpecs={{}}
        onChange={onChange}
      />
    );

    const keyInput = screen.getByLabelText('新增自定义属性名');
    const valInput = screen.getByLabelText('新增自定义属性值');
    const addBtn = screen.getByText('添加');

    fireEvent.change(keyInput, { target: { value: '码表' } });
    fireEvent.change(valInput, { target: { value: '迈金C406' } });
    fireEvent.click(addBtn);

    expect(onChange).toHaveBeenCalledWith({ '码表': '迈金C406' });
  });

  it('deletes an existing spec', () => {
    const onChange = vi.fn();
    render(
      <CustomSpecsEditor
        customSpecs={{ '脚踏': '平踏' }}
        onChange={onChange}
      />
    );

    const deleteBtn = screen.getByLabelText('删除 脚踏');
    fireEvent.click(deleteBtn);

    expect(onChange).toHaveBeenCalledWith({});
  });
});

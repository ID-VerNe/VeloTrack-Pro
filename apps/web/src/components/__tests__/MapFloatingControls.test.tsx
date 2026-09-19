import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MapFloatingControls from '../common/MapFloatingControls';

describe('MapFloatingControls 悬浮控制胶囊', () => {
  it('正确渲染适应、放大、缩小三个按键并响应点击', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onFitBounds = vi.fn();

    render(
      <MapFloatingControls
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFitBounds={onFitBounds}
        fitLabel="自适应当前城市"
      />
    );

    const fitBtn = screen.getByLabelText('自适应当前城市');
    const zoomInBtn = screen.getByLabelText('放大');
    const zoomOutBtn = screen.getByLabelText('缩小');

    expect(fitBtn).toBeInTheDocument();
    expect(zoomInBtn).toBeInTheDocument();
    expect(zoomOutBtn).toBeInTheDocument();

    fireEvent.click(fitBtn);
    expect(onFitBounds).toHaveBeenCalledTimes(1);

    fireEvent.click(zoomInBtn);
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    fireEvent.click(zoomOutBtn);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
  });

  it('支持自定义 className 位置布局', () => {
    const { container } = render(
      <MapFloatingControls
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onFitBounds={vi.fn()}
        className="custom-floating-position"
      />
    );

    expect(container.firstChild).toHaveClass('custom-floating-position');
  });
});

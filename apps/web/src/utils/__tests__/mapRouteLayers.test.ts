import { describe, it, expect } from 'vitest';
import {
  createRouteGlowLayer,
  createRouteCasingLayer,
  createRouteCoreLayer,
  createRouteHitTargetLayer,
} from '../mapRouteLayers';

describe('mapRouteLayers 工具函数', () => {
  it('正确生成发光图层配置 (createRouteGlowLayer)', () => {
    const layer = createRouteGlowLayer({
      id: 'glow-1',
      source: 'src-1',
      color: '#FF0000',
      width: 12,
      opacity: 0.8,
      blur: 3,
    });

    expect(layer.id).toBe('glow-1');
    expect(layer.type).toBe('line');
    expect(layer.source).toBe('src-1');
    expect(layer.layout).toEqual({ 'line-join': 'round', 'line-cap': 'round' });
    expect(layer.paint?.['line-color']).toBe('#FF0000');
    expect(layer.paint?.['line-width']).toBe(12);
    expect(layer.paint?.['line-opacity']).toBe(0.8);
    expect(layer.paint?.['line-blur']).toBe(3);
  });

  it('发光图层支持使用默认尺寸和模糊', () => {
    const layer = createRouteGlowLayer({
      id: 'glow-default',
      source: 'src-1',
      color: '#00FF00',
    });

    expect(layer.paint?.['line-width']).toBe(8);
    expect(layer.paint?.['line-opacity']).toBe(0.45);
    expect(layer.paint?.['line-blur']).toBe(2.5);
  });

  it('正确生成外包边图层配置 (createRouteCasingLayer)', () => {
    const layer = createRouteCasingLayer({
      id: 'casing-1',
      source: 'src-1',
      color: '#FFFFFF',
      width: 7,
      opacity: 0.9,
    });

    expect(layer.id).toBe('casing-1');
    expect(layer.type).toBe('line');
    expect(layer.paint?.['line-color']).toBe('#FFFFFF');
    expect(layer.paint?.['line-width']).toBe(7);
    expect(layer.paint?.['line-opacity']).toBe(0.9);
  });

  it('正确生成主核心线图层配置 (createRouteCoreLayer)', () => {
    const layer = createRouteCoreLayer({
      id: 'core-1',
      source: 'src-1',
      color: ['get', 'color'],
      width: 4,
      opacity: 1,
    });

    expect(layer.id).toBe('core-1');
    expect(layer.paint?.['line-color']).toEqual(['get', 'color']);
    expect(layer.paint?.['line-width']).toBe(4);
    expect(layer.paint?.['line-opacity']).toBe(1);
  });

  it('正确生成触控交互层配置 (createRouteHitTargetLayer)', () => {
    const layer = createRouteHitTargetLayer({
      id: 'hit-1',
      source: 'src-1',
      width: 30,
    });

    expect(layer.id).toBe('hit-1');
    expect(layer.paint?.['line-width']).toBe(30);
    expect(layer.paint?.['line-opacity']).toBe(0.001);
  });
});

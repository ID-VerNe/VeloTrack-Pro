import { describe, it, expect } from 'vitest';
import { MAP_STYLE_VISUALS } from '../mapVisualConfigs';

describe('MAP_STYLE_VISUALS 底图可视化配置', () => {
  it('包含 light / satellite 两个高德底图配置项', () => {
    expect(Object.keys(MAP_STYLE_VISUALS)).toEqual(['light', 'satellite']);
  });

  it('每个配置都包含必需的描边与内部线属性', () => {
    for (const key of Object.keys(MAP_STYLE_VISUALS) as (keyof typeof MAP_STYLE_VISUALS)[]) {
      const c = MAP_STYLE_VISUALS[key];
      expect(typeof c.casingColor).toBe('string');
      expect(typeof c.casingWidth).toBe('number');
      expect(typeof c.casingOpacity).toBe('number');
      expect(typeof c.innerWidth).toBe('number');
      expect(typeof c.milestoneClass).toBe('string');
      expect(c.milestoneClass.length).toBeGreaterThan(0);
    }
  });

  it('light 配置无发光属性，具体数值正确', () => {
    const c = MAP_STYLE_VISUALS.light;
    expect(c.glowColor).toBeUndefined();
    expect(c.glowWidth).toBeUndefined();
    expect(c.casingColor).toBe('#0F172A');
    expect(c.casingWidth).toBe(7);
    expect(c.casingOpacity).toBe(0.88);
    expect(c.innerWidth).toBe(4.5);
    expect(c.milestoneClass).toContain('bg-slate-900/90');
  });

  it('satellite 配置带深色描边与白底里程碑', () => {
    const c = MAP_STYLE_VISUALS.satellite;
    expect(c.glowColor).toBe('#0F172A');
    expect(c.glowWidth).toBe(9.5);
    expect(c.glowOpacity).toBe(0.65);
    expect(c.glowBlur).toBe(2.5);
    expect(c.casingColor).toBe('#FFFFFF');
    expect(c.casingWidth).toBe(7.5);
    expect(c.casingOpacity).toBe(0.98);
    expect(c.innerWidth).toBe(4.5);
    expect(c.milestoneClass).toContain('bg-white/95');
  });
});


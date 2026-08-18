import type { MapStyleKey } from './mapStyles';

export interface StyleVisualConfig {
  glowColor?: string;
  glowWidth?: number;
  glowOpacity?: number;
  glowBlur?: number;
  casingColor: string;
  casingWidth: number;
  casingOpacity: number;
  innerWidth: number;
  milestoneClass: string;
}

export const MAP_STYLE_VISUALS: Record<MapStyleKey, StyleVisualConfig> = {
  light: {
    casingColor: '#0F172A',
    casingWidth: 7,
    casingOpacity: 0.88,
    innerWidth: 4.5,
    milestoneClass: 'bg-slate-900/90 text-white border-white/90 shadow-md',
  },
  satellite: {
    glowColor: '#0F172A',
    glowWidth: 9.5,
    glowOpacity: 0.65,
    glowBlur: 2.5,
    casingColor: '#FFFFFF',
    casingWidth: 7.5,
    casingOpacity: 0.98,
    innerWidth: 4.5,
    milestoneClass: 'bg-white/95 text-slate-950 border-slate-900/40 shadow-xl font-black',
  },
};

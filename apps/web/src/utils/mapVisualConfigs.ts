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
  dark: {
    glowColor: '#38BDF8',
    glowWidth: 12,
    glowOpacity: 0.55,
    glowBlur: 4.0,
    casingColor: '#0284C7',
    casingWidth: 7,
    casingOpacity: 0.9,
    innerWidth: 4.5,
    milestoneClass: 'bg-slate-900/95 text-cyan-300 border-cyan-500/60 shadow-lg shadow-cyan-950/40',
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
  terrain: {
    glowColor: '#0F172A',
    glowWidth: 11,
    glowOpacity: 0.75,
    glowBlur: 2.0,
    casingColor: '#0F172A',
    casingWidth: 8.5,
    casingOpacity: 0.98,
    innerWidth: 5.5,
    milestoneClass: 'bg-slate-900 text-white border border-white/90 shadow-xl font-bold',
  },
};

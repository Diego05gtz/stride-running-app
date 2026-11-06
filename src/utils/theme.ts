import { AccentTheme } from '../types/run';

export interface ThemePalette {
  hex: string;
  glowHex: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  shadowStyle: string;
}

export const ACCENT_PALETTES: Record<AccentTheme, ThemePalette> = {
  mint: {
    hex: '#00F5A0',
    glowHex: 'rgba(0, 245, 160, 0.35)',
    textClass: 'text-[#00F5A0]',
    bgClass: 'bg-[#00F5A0]',
    borderClass: 'border-[#00F5A0]',
    shadowStyle: '0 0 28px rgba(0, 245, 160, 0.35)',
  },
  cyan: {
    hex: '#00D9F5',
    glowHex: 'rgba(0, 217, 245, 0.35)',
    textClass: 'text-[#00D9F5]',
    bgClass: 'bg-[#00D9F5]',
    borderClass: 'border-[#00D9F5]',
    shadowStyle: '0 0 28px rgba(0, 217, 245, 0.35)',
  },
  orange: {
    hex: '#FF5E3A',
    glowHex: 'rgba(255, 94, 58, 0.35)',
    textClass: 'text-[#FF5E3A]',
    bgClass: 'bg-[#FF5E3A]',
    borderClass: 'border-[#FF5E3A]',
    shadowStyle: '0 0 28px rgba(255, 94, 58, 0.35)',
  },
};

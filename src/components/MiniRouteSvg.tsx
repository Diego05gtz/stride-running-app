import React, { useMemo } from 'react';
import { AccentTheme, GeoPoint } from '../types/run';
import { ACCENT_PALETTES } from '../utils/theme';

interface MiniRouteSvgProps {
  path: GeoPoint[];
  accent: AccentTheme;
  className?: string;
}

/**
 * Renderiza una miniatura vectorial (SVG) limpia y con brillo neón a partir de las coordenadas GPS.
 */
export const MiniRouteSvg: React.FC<MiniRouteSvgProps> = ({
  path,
  accent,
  className = 'w-20 h-20',
}) => {
  const palette = ACCENT_PALETTES[accent];

  const svgPoints = useMemo(() => {
    if (!path || path.length < 2) return '';

    const lats = path.map((p) => p.lat);
    const lngs = path.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = Math.max(maxLat - minLat, 0.0005);
    const lngSpan = Math.max(maxLng - minLng, 0.0005);

    const padding = 10;
    const size = 80;
    const usable = size - padding * 2;

    return path
      .map((pt) => {
        const x = padding + ((pt.lng - minLng) / lngSpan) * usable;
        const y = size - padding - ((pt.lat - minLat) / latSpan) * usable;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [path]);

  if (!svgPoints) {
    return (
      <div
        className={`${className} rounded-2xl bg-[#090A0F] border border-white/5 flex items-center justify-center text-[10px] text-zinc-600`}
      >
        Sin ruta
      </div>
    );
  }

  return (
    <div
      className={`${className} rounded-2xl bg-[#090A0F] border border-white/10 p-1.5 flex items-center justify-center overflow-hidden relative`}
    >
      <svg viewBox="0 0 80 80" className="w-full h-full overflow-visible">
        <polyline
          fill="none"
          stroke={palette.hex}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.22"
          points={svgPoints}
        />
        <polyline
          fill="none"
          stroke={palette.hex}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={svgPoints}
        />
      </svg>
    </div>
  );
};

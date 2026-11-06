import { AccentTheme, RunActivity, UnitSystem } from '../types/run';
import { formatDistance, formatDuration, formatPace } from './geoMath';
import { ACCENT_PALETTES } from './theme';

/**
 * Dibuja un rectángulo con bordes redondeados en un contexto 2D de Canvas
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Genera y descarga un Póster Vertical PNG de alta resolución (1080x1920 - Instagram Story)
 * usando HTML5 Canvas nativo con el trazo neón de la ruta y las 3 métricas protagonistas.
 */
export function exportRunPosterPng(
  activity: RunActivity,
  unit: UnitSystem,
  accent: AccentTheme
): void {
  const WIDTH = 1080;
  const HEIGHT = 1920;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const palette = ACCENT_PALETTES[accent];

  // 1. Fondo Oscuro Deportivo Profundo (Gradiente Lineal + Halo Radial Central)
  const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  bgGrad.addColorStop(0, '#07080C');
  bgGrad.addColorStop(0.5, '#0D1018');
  bgGrad.addColorStop(1, '#07080C');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Halo radial neón sutil detrás de la ruta
  const radialGlow = ctx.createRadialGradient(
    WIDTH / 2,
    HEIGHT * 0.44,
    40,
    WIDTH / 2,
    HEIGHT * 0.44,
    520
  );
  radialGlow.addColorStop(0, palette.glowHex);
  radialGlow.addColorStop(1, 'rgba(9, 10, 15, 0)');
  ctx.fillStyle = radialGlow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Cuadrícula técnica minimalista muy sutil
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
  ctx.lineWidth = 1;
  const gridStep = 90;
  for (let x = gridStep; x < WIDTH; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = gridStep; y < HEIGHT; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  // 2. Cabecera: Logo STRIDE + Título + Fecha
  // Píldora superior de marca
  drawRoundedRect(ctx, 84, 96, 220, 58, 29);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Punto neón dentro de la píldora
  ctx.beginPath();
  ctx.arc(124, 125, 10, 0, Math.PI * 2);
  ctx.fillStyle = palette.hex;
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 28px "Outfit", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('STRIDE', 150, 135);

  // Insignia si existe
  if (activity.badge) {
    drawRoundedRect(ctx, WIDTH - 364, 96, 280, 58, 29);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fill();
    ctx.strokeStyle = palette.hex;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = palette.hex;
    ctx.font = '700 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`★ ${activity.badge.toUpperCase()}`, WIDTH - 224, 134);
  }

  // Título de la sesión y fecha
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 64px "Outfit", system-ui, sans-serif';
  ctx.fillText(activity.title, 84, 248);

  const formattedDate = new Date(activity.dateIso).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '500 30px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1),
    84,
    302
  );

  // 3. Marco Central: Trazo Vectorial Neón de la Ruta GPS
  const mapBoxX = 84;
  const mapBoxY = 360;
  const mapBoxW = WIDTH - 168;
  const mapBoxH = 820;

  drawRoundedRect(ctx, mapBoxX, mapBoxY, mapBoxW, mapBoxH, 48);
  ctx.fillStyle = 'rgba(16, 18, 26, 0.78)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const path = activity.path;
  if (path && path.length >= 2) {
    const lats = path.map((p) => p.lat);
    const lngs = path.map((p) => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latSpan = Math.max(maxLat - minLat, 0.0004);
    const lngSpan = Math.max(maxLng - minLng, 0.0004);

    const pad = 110;
    const drawW = mapBoxW - pad * 2;
    const drawH = mapBoxH - pad * 2;

    const mappedPts = path.map((pt) => {
      const x = mapBoxX + pad + ((pt.lng - minLng) / lngSpan) * drawW;
      const y =
        mapBoxY + mapBoxH - pad - ((pt.lat - minLat) / latSpan) * drawH;
      return { x, y };
    });

    // Capa 1: Resplandor Neón Exterior (Glow)
    ctx.save();
    ctx.beginPath();
    mappedPts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = palette.hex;
    ctx.lineWidth = 28;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = 0.24;
    ctx.shadowColor = palette.hex;
    ctx.shadowBlur = 35;
    ctx.stroke();
    ctx.restore();

    // Capa 2: Núcleo Neón Brillante
    ctx.save();
    ctx.beginPath();
    mappedPts.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = palette.hex;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();

    // Punto de Inicio (Blanco)
    const startPt = mappedPts[0];
    ctx.beginPath();
    ctx.arc(startPt.x, startPt.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#090A0F';
    ctx.stroke();

    // Punto Final (Acento Neón con Halo)
    const endPt = mappedPts[mappedPts.length - 1];
    ctx.beginPath();
    ctx.arc(endPt.x, endPt.y, 26, 0, Math.PI * 2);
    ctx.fillStyle = palette.glowHex;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(endPt.x, endPt.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = palette.hex;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#090A0F';
    ctx.stroke();
  }

  // 4. Tarjeta HUD Inferior con las 3 Métricas Protagonistas
  const hudX = 84;
  const hudY = 1230;
  const hudW = WIDTH - 168;
  const hudH = 510;

  drawRoundedRect(ctx, hudX, hudY, hudW, hudH, 48);
  ctx.fillStyle = '#10121A';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Protagonista Central: DISTANCIA GIGANTE
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '700 24px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    `DISTANCIA TOTAL (${unit.toUpperCase()})`,
    WIDTH / 2,
    hudY + 78
  );

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 148px "Outfit", system-ui, sans-serif';
  ctx.fillText(
    `${formatDistance(activity.distanceKm, unit)}`,
    WIDTH / 2,
    hudY + 225
  );

  // Línea divisoria horizontal
  ctx.beginPath();
  ctx.moveTo(hudX + 64, hudY + 280);
  ctx.lineTo(hudX + hudW - 64, hudY + 280);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Dos métricas inferiores: RITMO PROMEDIO y TIEMPO TOTAL
  const leftColX = hudX + hudW * 0.27;
  const rightColX = hudX + hudW * 0.73;

  ctx.fillStyle = '#9CA3AF';
  ctx.font = '700 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`RITMO MEDIO (MIN/${unit.toUpperCase()})`, leftColX, hudY + 340);
  ctx.fillText('TIEMPO EN MOVIMIENTO', rightColX, hudY + 340);

  ctx.fillStyle = palette.hex;
  ctx.font = '800 76px "Outfit", system-ui, sans-serif';
  ctx.fillText(
    formatPace(activity.avgPaceSecondsPerKm, unit),
    leftColX,
    hudY + 432
  );

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 76px "Outfit", system-ui, sans-serif';
  ctx.fillText(
    formatDuration(activity.durationSeconds),
    rightColX,
    hudY + 432
  );

  // 5. Pie de firma minimalista
  ctx.fillStyle = '#6B7280';
  ctx.font = '600 24px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `STRIDE RUNNING CLUB  •  ${activity.calories} KCAL`,
    WIDTH / 2,
    1835
  );

  // Descargar PNG automáticamente
  const dataUrl = canvas.toDataURL('image/png');
  const dateSlug = activity.dateIso.slice(0, 10);
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `stride-poster-${dateSlug}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

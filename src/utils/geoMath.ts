import { GeoPoint, Split, UnitSystem } from '../types/run';

const EARTH_RADIUS_KM = 6371;
const KM_TO_MILES = 0.621371;

/**
 * Calcula la distancia entre dos coordenadas GPS usando la fórmula de Haversine.
 * @returns Distancia en kilómetros (km)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Filtro de precisión y ruido GPS para uso real en calle (iOS / Android):
 * - Acepta lecturas satelitales móviles (accuracy <= 65m) que representen un desplazamiento real >= 1.8m
 *   respecto al último punto guardado, permitiendo caminar, trotar suave o correr con trazo continuo.
 * - Ignora saltos irreales / teletransportaciones (> 12.5 m/s ≈ 45 km/h).
 */
export function isValidGpsStep(
  prevPoint: GeoPoint,
  newLat: number,
  newLng: number,
  newTimestamp: number,
  accuracy: number,
  isSimulated: boolean
): { valid: boolean; distanceKm: number; speedMs: number } {
  if (!isSimulated && accuracy > 65) {
    return { valid: false, distanceKm: 0, speedMs: 0 };
  }

  const distanceKm = calculateHaversineDistance(
    prevPoint.lat,
    prevPoint.lng,
    newLat,
    newLng
  );
  const distanceMeters = distanceKm * 1000;
  const timeDeltaSec = Math.max((newTimestamp - prevPoint.timestamp) / 1000, 0.5);
  const speedMs = distanceMeters / timeDeltaSec;

  // Aceptar cualquier desplazamiento real >= 1.8 metros (0.5m en simulador)
  const minThresholdMeters = isSimulated ? 0.5 : 1.8;
  if (distanceMeters < minThresholdMeters) {
    return { valid: false, distanceKm: 0, speedMs: 0 };
  }

  // Ignorar picos irreales de velocidad (> 12.5 m/s para un corredor humano)
  if (speedMs > 12.5) {
    return { valid: false, distanceKm: 0, speedMs: 0 };
  }

  return { valid: true, distanceKm, speedMs };
}

/**
 * Calcula el Ritmo Actual (Pace en seg/km) suavizado mediante una ventana móvil
 * de los últimos 14 segundos de puntos válidos para evitar saltos bruscos en pantalla.
 */
export function calculateRollingPaceSecondsPerKm(points: GeoPoint[]): number {
  if (points.length < 2) return 0;

  const latest = points[points.length - 1];
  const windowMs = 14000; // 14 segundos de media móvil

  // Buscar el punto más antiguo dentro de la ventana de 14s
  let anchorIndex = points.length - 2;
  while (
    anchorIndex > 0 &&
    latest.timestamp - points[anchorIndex].timestamp < windowMs
  ) {
    anchorIndex--;
  }

  const anchor = points[anchorIndex];
  const deltaDistKm = latest.cumulativeDistanceKm - anchor.cumulativeDistanceKm;
  const deltaTimeSec = (latest.timestamp - anchor.timestamp) / 1000;

  if (deltaDistKm <= 0.003 || deltaTimeSec <= 0.8) {
    return 0;
  }

  const paceSecPerKm = deltaTimeSec / deltaDistKm;
  // Limitar entre 2:15/km (135s) y 18:00/km (1080s) para evitar valores extremos al arrancar
  if (paceSecPerKm < 135 || paceSecPerKm > 1080) {
    return Math.min(Math.max(paceSecPerKm, 135), 1080);
  }

  return paceSecPerKm;
}

/**
 * Convierte segundos por kilómetro a string "M'SS"" o "--'--"" ajustado por unidad (km o mi)
 */
export function formatPace(
  paceSecondsPerKm: number,
  unit: UnitSystem = 'km'
): string {
  if (!paceSecondsPerKm || !isFinite(paceSecondsPerKm) || paceSecondsPerKm <= 0) {
    return "--'--\"";
  }

  const adjustedSeconds =
    unit === 'mi' ? paceSecondsPerKm / KM_TO_MILES : paceSecondsPerKm;

  const totalSeconds = Math.round(adjustedSeconds);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 25) return "--'--\"";
  return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
}

/**
 * Formatea distancia en km o millas con 2 decimales limpios
 */
export function formatDistance(
  distanceKm: number,
  unit: UnitSystem = 'km'
): string {
  const val = unit === 'mi' ? distanceKm * KM_TO_MILES : distanceKm;
  return val.toFixed(2);
}

/**
 * Formatea segundos totales en MM:SS o HH:MM:SS para lectura en <3 segundos
 */
export function formatDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

/**
 * Generador de pasos para el Modo Simulación:
 * Traza un circuito orgánico y realista alrededor del punto inicial con variaciones suaves de ritmo.
 */
export function generateSimulatedNextCoords(
  currentLat: number,
  currentLng: number,
  stepCount: number
): { lat: number; lng: number; accuracy: number; speedMs: number } {
  // Variación orgánica del rumbo usando ondas sinusoidales suaves (circuito tipo parque)
  const baseHeadingRad =
    (stepCount * 0.045) +
    Math.sin(stepCount * 0.12) * 0.35 +
    Math.cos(stepCount * 0.05) * 0.2;

  // Velocidad simulada entre 3.35 m/s (~4'58"/km) y 3.85 m/s (~4'20"/km)
  const speedMs = 3.55 + Math.sin(stepCount * 0.18) * 0.25;
  const distanceKm = speedMs / 1000; // avance en 1 segundo

  // Conversión aproximada de desplazamiento en km a grados de latitud/longitud
  const deltaLat = (distanceKm * Math.cos(baseHeadingRad)) / 111.32;
  const deltaLng =
    (distanceKm * Math.sin(baseHeadingRad)) /
    (111.32 * Math.cos((currentLat * Math.PI) / 180));

  return {
    lat: currentLat + deltaLat,
    lng: currentLng + deltaLng,
    accuracy: 4.2,
    speedMs,
  };
}

/**
 * Calcula los splits por kilómetro a partir del historial de puntos
 */
export function computeSplitsFromPath(path: GeoPoint[]): Split[] {
  if (path.length < 2) return [];

  const splits: Split[] = [];
  let targetKm = 1;
  let lastSplitTimestamp = path[0].timestamp;

  for (let i = 1; i < path.length; i++) {
    const pt = path[i];
    if (pt.cumulativeDistanceKm >= targetKm) {
      const splitDurationSec = Math.max(
        1,
        Math.round((pt.timestamp - lastSplitTimestamp) / 1000)
      );
      splits.push({
        kmIndex: targetKm,
        durationSeconds: splitDurationSec,
        paceSecondsPerKm: splitDurationSec,
        distanceKm: 1,
      });
      lastSplitTimestamp = pt.timestamp;
      targetKm += 1;
    }
  }

  return splits;
}

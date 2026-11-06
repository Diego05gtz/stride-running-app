import { GeoPoint, RunActivity, UserPreferences } from '../types/run';
import { generateSimulatedNextCoords, calculateHaversineDistance } from './geoMath';

const RUNS_STORAGE_KEY = 'stride_runs_v1';
const PREFS_STORAGE_KEY = 'stride_prefs_v1';
export const WEEKLY_GOAL_STORAGE_KEY = 'stride_weekly_goal_km';

const DEFAULT_PREFS: UserPreferences = {
  unit: 'km',
  weeklyGoalKm: 25,
  accent: 'mint',
  voiceCoachEnabled: true,
  autoPauseEnabled: true,
  weightKg: 70,
};

/**
 * Fórmula metabólica real para carrera a pie: kcal = peso (kg) * distancia (km) * 1.036
 */
export function calculateMetabolicCalories(
  distanceKm: number,
  weightKg: number = 70
): number {
  return Math.max(0, Math.round(weightKg * distanceKm * 1.036));
}

function buildSamplePath(
  startLat: number,
  startLng: number,
  totalSteps: number
): GeoPoint[] {
  const points: GeoPoint[] = [];
  let lat = startLat;
  let lng = startLng;
  let cumDist = 0;
  const startTime = Date.now() - 86400000 * 2;

  points.push({
    lat,
    lng,
    timestamp: startTime,
    accuracy: 4,
    speed: 3.5,
    cumulativeDistanceKm: 0,
  });

  for (let i = 1; i <= totalSteps; i++) {
    const next = generateSimulatedNextCoords(lat, lng, i * 3);
    const d = calculateHaversineDistance(lat, lng, next.lat, next.lng);
    cumDist += d;
    lat = next.lat;
    lng = next.lng;
    points.push({
      lat,
      lng,
      timestamp: startTime + i * 3000,
      accuracy: 4,
      speed: next.speedMs,
      cumulativeDistanceKm: cumDist,
    });
  }
  return points;
}

const SEED_RUNS: RunActivity[] = [
  {
    id: 'seed-run-1',
    title: 'Rodaje Nocturno Tempo',
    dateIso: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
    durationSeconds: 1515, // 25:15
    distanceKm: 5.42,
    avgPaceSecondsPerKm: 279, // 4'39"/km
    calories: calculateMetabolicCalories(5.42, 70),
    isSimulated: false,
    badge: 'Récord 5K',
    feeling: '🔥 Fuerte',
    path: buildSamplePath(19.4204, -99.1819, 140),
    splits: [
      { kmIndex: 1, durationSeconds: 288, paceSecondsPerKm: 288, distanceKm: 1 },
      { kmIndex: 2, durationSeconds: 281, paceSecondsPerKm: 281, distanceKm: 1 },
      { kmIndex: 3, durationSeconds: 276, paceSecondsPerKm: 276, distanceKm: 1 },
      { kmIndex: 4, durationSeconds: 274, paceSecondsPerKm: 274, distanceKm: 1 },
      { kmIndex: 5, durationSeconds: 270, paceSecondsPerKm: 270, distanceKm: 1 },
    ],
  },
  {
    id: 'seed-run-2',
    title: 'Carrera Matutina Suave',
    dateIso: new Date(Date.now() - 1000 * 60 * 60 * 64).toISOString(),
    durationSeconds: 2490, // 41:30
    distanceKm: 8.15,
    avgPaceSecondsPerKm: 305, // 5'05"/km
    calories: calculateMetabolicCalories(8.15, 70),
    isSimulated: false,
    badge: 'Ruta más larga',
    feeling: '🌿 Ligera',
    path: buildSamplePath(19.4152, -99.1725, 190),
    splits: [
      { kmIndex: 1, durationSeconds: 312, paceSecondsPerKm: 312, distanceKm: 1 },
      { kmIndex: 2, durationSeconds: 308, paceSecondsPerKm: 308, distanceKm: 1 },
      { kmIndex: 3, durationSeconds: 305, paceSecondsPerKm: 305, distanceKm: 1 },
      { kmIndex: 4, durationSeconds: 302, paceSecondsPerKm: 302, distanceKm: 1 },
      { kmIndex: 5, durationSeconds: 306, paceSecondsPerKm: 306, distanceKm: 1 },
      { kmIndex: 6, durationSeconds: 304, paceSecondsPerKm: 304, distanceKm: 1 },
      { kmIndex: 7, durationSeconds: 301, paceSecondsPerKm: 301, distanceKm: 1 },
      { kmIndex: 8, durationSeconds: 298, paceSecondsPerKm: 298, distanceKm: 1 },
    ],
  },
  {
    id: 'seed-run-3',
    title: 'Intervalos de Velocidad',
    dateIso: new Date(Date.now() - 1000 * 60 * 60 * 115).toISOString(),
    durationSeconds: 1080, // 18:00
    distanceKm: 4.05,
    avgPaceSecondsPerKm: 266, // 4'26"/km
    calories: calculateMetabolicCalories(4.05, 70),
    isSimulated: false,
    badge: 'Mejor Ritmo',
    feeling: '⚡ Rápida',
    path: buildSamplePath(19.4265, -99.1912, 110),
    splits: [
      { kmIndex: 1, durationSeconds: 272, paceSecondsPerKm: 272, distanceKm: 1 },
      { kmIndex: 2, durationSeconds: 265, paceSecondsPerKm: 265, distanceKm: 1 },
      { kmIndex: 3, durationSeconds: 262, paceSecondsPerKm: 262, distanceKm: 1 },
      { kmIndex: 4, durationSeconds: 264, paceSecondsPerKm: 264, distanceKm: 1 },
    ],
  },
];

export function loadSavedRuns(): RunActivity[] {
  try {
    const raw = localStorage.getItem(RUNS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(SEED_RUNS));
      return SEED_RUNS;
    }
    return JSON.parse(raw);
  } catch {
    return SEED_RUNS;
  }
}

export function saveNewRun(run: RunActivity): RunActivity[] {
  const existing = loadSavedRuns();
  const updated = [run, ...existing];
  try {
    localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Fallback si localStorage se llena
  }
  return updated;
}

export function updateSavedRun(
  id: string,
  partial: Partial<RunActivity>
): RunActivity[] {
  const existing = loadSavedRuns();
  const updated = existing.map((r) => (r.id === id ? { ...r, ...partial } : r));
  try {
    localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function deleteSavedRun(id: string): RunActivity[] {
  const existing = loadSavedRuns();
  const updated = existing.filter((r) => r.id !== id);
  try {
    localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

export function loadUserPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY);
    const parsed = raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
    const savedGoalRaw = localStorage.getItem(WEEKLY_GOAL_STORAGE_KEY);
    if (savedGoalRaw !== null) {
      const savedGoalNum = Number(savedGoalRaw);
      if (Number.isFinite(savedGoalNum) && savedGoalNum > 0) {
        parsed.weeklyGoalKm = savedGoalNum;
      }
    }
    return parsed;
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveUserPreferences(prefs: UserPreferences): void {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
    localStorage.setItem(WEEKLY_GOAL_STORAGE_KEY, String(prefs.weeklyGoalKm));
  } catch {
    // ignore
  }
}

/**
 * Descarga un archivo .json con todas las carreras y preferencias del usuario
 */
export function exportBackupJson(
  runs: RunActivity[],
  prefs: UserPreferences
): void {
  const payload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    prefs,
    runs,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const dateSlug = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `stride-backup-${dateSlug}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Restaura carreras y preferencias desde un archivo JSON de respaldo
 */
export async function parseBackupJsonFile(
  file: File
): Promise<{ runs: RunActivity[]; prefs: UserPreferences }> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.runs)) {
    throw new Error('Formato de respaldo inválido.');
  }
  const runs: RunActivity[] = parsed.runs;
  const prefs: UserPreferences = {
    ...DEFAULT_PREFS,
    ...(parsed.prefs || {}),
  };
  localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(runs));
  localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  return { runs, prefs };
}

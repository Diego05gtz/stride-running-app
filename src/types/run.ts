export type UnitSystem = 'km' | 'mi';
export type AccentTheme = 'mint' | 'cyan' | 'orange';
export type GpsSignalQuality = 'excellent' | 'good' | 'poor' | 'searching' | 'simulated';
export type PermissionStateStatus = 'prompt' | 'granted' | 'denied';
export type RunStatus = 'idle' | 'running' | 'paused' | 'completed';
export type WorkoutMode = 'free' | 'goal' | 'intervals';
export type GoalDistanceKm = 3 | 5 | 10;
export type IntervalPhase = 'fast' | 'recovery';
export type RunFeeling = '🔥 Fuerte' | '⚡ Rápida' | '🌿 Ligera';

export interface GeoPoint {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy: number;
  speed: number | null; // m/s
  cumulativeDistanceKm: number;
}

export interface Split {
  kmIndex: number;
  durationSeconds: number;
  paceSecondsPerKm: number;
  distanceKm: number;
}

export interface RunActivity {
  id: string;
  title: string;
  dateIso: string;
  durationSeconds: number;
  distanceKm: number;
  avgPaceSecondsPerKm: number;
  calories: number;
  path: GeoPoint[];
  splits: Split[];
  isSimulated: boolean;
  badge?: string;
  feeling?: RunFeeling;
  note?: string;
}

export interface UserPreferences {
  unit: UnitSystem;
  weeklyGoalKm: number;
  simulationMode: boolean;
  accent: AccentTheme;
  voiceCoachEnabled: boolean;
  autoPauseEnabled: boolean;
  weightKg: number;
}

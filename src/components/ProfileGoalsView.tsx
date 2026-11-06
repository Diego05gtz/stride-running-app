import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Target,
  Palette,
  Ruler,
  Scale,
  Flame,
  Trophy,
  Download,
  Upload,
  Check,
  Pencil,
} from 'lucide-react';
import {
  AccentTheme,
  RunActivity,
  UnitSystem,
  UserPreferences,
} from '../types/run';
import { formatDistance, formatPace } from '../utils/geoMath';
import {
  exportBackupJson,
  parseBackupJsonFile,
  WEEKLY_GOAL_STORAGE_KEY,
} from '../utils/storage';
import { ACCENT_PALETTES } from '../utils/theme';

interface ProfileGoalsViewProps {
  runs: RunActivity[];
  prefs: UserPreferences;
  onUpdatePrefs: (updated: Partial<UserPreferences>) => void;
  onRestoreBackup: (data: {
    runs: RunActivity[];
    prefs: UserPreferences;
  }) => void;
}

const GOAL_PRESETS_KM = [15, 25, 40, 60];
const WEIGHT_PRESETS_KG = [58, 65, 70, 78, 85];

export const ProfileGoalsView: React.FC<ProfileGoalsViewProps> = ({
  runs,
  prefs,
  onUpdatePrefs,
  onRestoreBackup,
}) => {
  const palette = ACCENT_PALETTES[prefs.accent];
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [customGoalInput, setCustomGoalInput] = useState<string>(
    String(prefs.weeklyGoalKm)
  );
  const [goalSavedFlash, setGoalSavedFlash] = useState(false);

  useEffect(() => {
    setCustomGoalInput(String(prefs.weeklyGoalKm));
  }, [prefs.weeklyGoalKm]);

  const handleSaveWeeklyGoalKm = (rawKm: number) => {
    const clampedKm = Math.min(500, Math.max(1, Math.round(rawKm)));
    try {
      localStorage.setItem(WEEKLY_GOAL_STORAGE_KEY, String(clampedKm));
    } catch {
      // ignore
    }
    onUpdatePrefs({ weeklyGoalKm: clampedKm });
    setCustomGoalInput(String(clampedKm));
    setGoalSavedFlash(true);
    window.setTimeout(() => setGoalSavedFlash(false), 1800);
  };

  // Calcular distancia de los últimos 7 días
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weeklyDistanceKm = runs
    .filter((r) => new Date(r.dateIso).getTime() >= oneWeekAgo)
    .reduce((sum, r) => sum + r.distanceKm, 0);

  const progressRatio = Math.min(1, weeklyDistanceKm / prefs.weeklyGoalKm);
  const progressPercent = Math.round(progressRatio * 100);

  // Estadísticas Globales, Récords Personales (PRs) y Racha Activa
  const stats = useMemo(() => {
    const totalKm = runs.reduce((acc, r) => acc + r.distanceKm, 0);
    const longestKm =
      runs.length > 0 ? Math.max(...runs.map((r) => r.distanceKm)) : 0;
    const validPaces = runs
      .filter((r) => r.distanceKm >= 1 && r.avgPaceSecondsPerKm > 120)
      .map((r) => r.avgPaceSecondsPerKm);
    const fastestPaceSec =
      validPaces.length > 0 ? Math.min(...validPaces) : 0;

    // Calcular días únicos activos y semanas consecutivas con actividad
    const uniqueDays = new Set(
      runs.map((r) => new Date(r.dateIso).toISOString().slice(0, 10))
    ).size;

    return {
      totalKm,
      longestKm,
      fastestPaceSec,
      activeDaysCount: uniqueDays,
    };
  }, [runs]);

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const restored = await parseBackupJsonFile(file);
      onRestoreBackup(restored);
      setBackupMessage('Respaldo restaurado correctamente');
      setTimeout(() => setBackupMessage(null), 3000);
    } catch {
      setBackupMessage('Archivo JSON no válido');
      setTimeout(() => setBackupMessage(null), 3000);
    }
  };

  // Geometría del anillo circular SVG
  const size = 220;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progressRatio);

  return (
    <div className="w-full h-[100dvh] min-h-[100dvh] overflow-y-auto px-5 pt-8 pb-28 max-w-lg mx-auto">
      <header className="text-center mb-5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Objetivo Semanal
        </span>
        <h1 className="font-display text-2xl font-bold text-white mt-1">
          Tu Progreso en 7 Días
        </h1>
      </header>

      {/* PROTAGONISTA VISUAL: Anillo de Progreso Circular Neón */}
      <div className="relative flex items-center justify-center my-3">
        <svg width={size} height={size} className="-rotate-90 transform">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={palette.hex}
            strokeWidth={strokeWidth + 6}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            strokeOpacity={0.2}
            className="transition-all duration-700 ease-out"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={palette.hex}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-5xl font-extrabold text-white tabular-nums tracking-tight">
            {formatDistance(weeklyDistanceKm, prefs.unit)}
          </span>
          <span className="text-xs font-medium text-zinc-400 mt-1 tabular-nums">
            de {formatDistance(prefs.weeklyGoalKm, prefs.unit)} {prefs.unit} (
            {progressPercent}%)
          </span>
        </div>
      </div>

      {/* RACHA SEMANAL Y RÉCORDS PERSONALES (PRs) */}
      <div className="mt-6 grid grid-cols-3 gap-2.5">
        <div className="rounded-3xl bg-[#10121A] border border-white/[0.07] p-3.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Racha</span>
          </div>
          <span className="font-display text-2xl font-extrabold text-white tabular-nums mt-1 block">
            {stats.activeDaysCount}
          </span>
          <span className="text-[10px] text-zinc-500">días activos</span>
        </div>

        <div className="rounded-3xl bg-[#10121A] border border-white/[0.07] p-3.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            <Trophy className={`w-3.5 h-3.5 ${palette.textClass}`} />
            <span>Mejor Ritmo</span>
          </div>
          <span
            className={`font-display text-2xl font-extrabold tabular-nums mt-1 block ${palette.textClass}`}
          >
            {formatPace(stats.fastestPaceSec, prefs.unit)}
          </span>
          <span className="text-[10px] text-zinc-500">min/{prefs.unit}</span>
        </div>

        <div className="rounded-3xl bg-[#10121A] border border-white/[0.07] p-3.5 text-center">
          <div className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            <Target className="w-3.5 h-3.5 text-cyan-400" />
            <span>Mayor Ruta</span>
          </div>
          <span className="font-display text-2xl font-extrabold text-white tabular-nums mt-1 block">
            {formatDistance(stats.longestKm, prefs.unit)}
          </span>
          <span className="text-[10px] text-zinc-500">
            {prefs.unit} (Total: {formatDistance(stats.totalKm, prefs.unit)})
          </span>
        </div>
      </div>

      {/* CONTROLES RÁPIDOS Y PREFERENCIAS */}
      <div className="mt-4 space-y-4">
        {/* Selector de Meta Semanal (Presets + Input Manual con persistencia en stride_weekly_goal_km) */}
        <div className="rounded-3xl bg-[#10121A] border border-white/[0.07] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <Target className={`w-4 h-4 ${palette.textClass}`} />
              <span>Meta Semanal (km)</span>
            </div>
            {goalSavedFlash && (
              <span
                className={`text-[11px] font-semibold flex items-center gap-1 ${palette.textClass}`}
              >
                <Check className="w-3.5 h-3.5" />
                Guardada
              </span>
            )}
          </div>

          {/* Input manual limpio para establecer cualquier Meta Semanal en km */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const parsed = Number(customGoalInput);
              if (Number.isFinite(parsed) && parsed > 0) {
                handleSaveWeeklyGoalKm(parsed);
              }
            }}
            className="flex items-center gap-2 mb-3"
          >
            <div className="relative flex-1 flex items-center rounded-2xl bg-[#090A0F] border border-white/10 px-3.5 py-2 focus-within:border-white/30 transition">
              <Pencil className="w-3.5 h-3.5 text-zinc-500 mr-2 shrink-0" />
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                inputMode="numeric"
                value={customGoalInput}
                onChange={(e) => setCustomGoalInput(e.target.value)}
                placeholder="Ej. 30"
                className="w-full bg-transparent font-display font-bold text-base text-white tabular-nums focus:outline-none"
                aria-label="Meta semanal manual en kilómetros"
              />
              <span className="text-xs font-semibold text-zinc-500 ml-1">
                km / sem
              </span>
            </div>

            <button
              type="submit"
              className={`px-4 py-2.5 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition active:scale-95 ${palette.bgClass} text-[#090A0F]`}
            >
              Guardar
            </button>
          </form>

          {/* Botones de selección rápida */}
          <div className="grid grid-cols-4 gap-2">
            {GOAL_PRESETS_KM.map((goalKm) => {
              const active = prefs.weeklyGoalKm === goalKm;
              return (
                <button
                  key={goalKm}
                  type="button"
                  onClick={() => handleSaveWeeklyGoalKm(goalKm)}
                  className={`py-2 rounded-2xl font-display font-bold text-xs tabular-nums transition ${
                    active
                      ? `${palette.bgClass} text-[#090A0F]`
                      : 'bg-white/5 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {prefs.unit === 'mi'
                    ? Math.round(goalKm * 0.621371)
                    : goalKm}{' '}
                  {prefs.unit}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selector de Peso Corporal (kg) para Calorías Metabólicas Exactas */}
        <div className="rounded-3xl bg-[#10121A] border border-white/[0.07] p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <Scale className={`w-4 h-4 ${palette.textClass}`} />
              <span>Peso Corporal (Cálculo Kcal)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  onUpdatePrefs({
                    weightKg: Math.max(40, (prefs.weightKg || 70) - 1),
                  })
                }
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white font-bold text-sm"
              >
                -
              </button>
              <span className="font-display font-bold text-base text-white tabular-nums w-14 text-center">
                {prefs.weightKg || 70} kg
              </span>
              <button
                onClick={() =>
                  onUpdatePrefs({
                    weightKg: Math.min(140, (prefs.weightKg || 70) + 1),
                  })
                }
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/15 text-white font-bold text-sm"
              >
                +
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {WEIGHT_PRESETS_KG.map((kg) => {
              const active = prefs.weightKg === kg;
              return (
                <button
                  key={kg}
                  onClick={() => onUpdatePrefs({ weightKg: kg })}
                  className={`py-2 rounded-xl text-xs font-bold tabular-nums transition ${
                    active
                      ? `${palette.bgClass} text-[#090A0F]`
                      : 'bg-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  {kg} kg
                </button>
              );
            })}
          </div>
        </div>

        {/* Selector de Unidades (km / mi) */}
        <div className="rounded-3xl bg-[#10121A] border border-white/[0.07] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            <Ruler className={`w-4 h-4 ${palette.textClass}`} />
            <span>Unidades de Distancia y Ritmo</span>
          </div>
          <div className="grid grid-cols-2 gap-2 bg-[#090A0F] p-1 rounded-2xl border border-white/5">
            {(['km', 'mi'] as UnitSystem[]).map((u) => (
              <button
                key={u}
                onClick={() => onUpdatePrefs({ unit: u })}
                className={`py-2.5 rounded-xl text-xs font-bold uppercase transition ${
                  prefs.unit === u
                    ? `${palette.bgClass} text-[#090A0F]`
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {u === 'km' ? 'Kilómetros (km)' : 'Millas (mi)'}
              </button>
            ))}
          </div>
        </div>

        {/* Selector de Acento Neón Deportivo */}
        <div className="rounded-3xl bg-[#10121A] border border-white/[0.07] p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
            <Palette className={`w-4 h-4 ${palette.textClass}`} />
            <span>Acento de Neón Deportivo</span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                { id: 'mint', label: 'Verde Menta', color: '#00F5A0' },
                { id: 'cyan', label: 'Azul Cian', color: '#00D9F5' },
                { id: 'orange', label: 'Naranja Neón', color: '#FF5E3A' },
              ] as { id: AccentTheme; label: string; color: string }[]
            ).map((item) => {
              const isSelected = prefs.accent === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onUpdatePrefs({ accent: item.id })}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-white/10 border-white/30 text-white'
                      : 'bg-white/[0.02] border-white/5 text-zinc-400 hover:text-white'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Respaldo y Restauración de Datos (.json) */}
        <div className="rounded-3xl bg-[#10121A] border border-white/[0.07] p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Respaldo de Historial y Ajustes
            </span>
            {backupMessage && (
              <span
                className={`text-[11px] font-semibold flex items-center gap-1 ${palette.textClass}`}
              >
                <Check className="w-3.5 h-3.5" />
                {backupMessage}
              </span>
            )}
          </div>

          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleRestoreFile}
            className="hidden"
          />

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => exportBackupJson(runs, prefs)}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition active:scale-95"
            >
              <Download className={`w-3.5 h-3.5 ${palette.textClass}`} />
              <span>Exportar Respaldo (.json)</span>
            </button>

            <button
              onClick={() => backupInputRef.current?.click()}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl bg-white/[0.06] hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 hover:text-white transition active:scale-95"
            >
              <Upload className="w-3.5 h-3.5 text-zinc-400" />
              <span>Restaurar Datos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

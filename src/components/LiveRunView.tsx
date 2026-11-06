import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Square,
  ChevronUp,
  ChevronDown,
  Smartphone,
  Volume2,
  VolumeX,
  Flag,
  Zap,
  Footprints,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  AccentTheme,
  GeoPoint,
  GoalDistanceKm,
  GpsSignalQuality,
  IntervalPhase,
  RunStatus,
  Split,
  UnitSystem,
  WorkoutMode,
} from '../types/run';
import {
  formatDistance,
  formatDuration,
  formatPace,
} from '../utils/geoMath';
import { calculateMetabolicCalories } from '../utils/storage';
import { ACCENT_PALETTES } from '../utils/theme';
import { LiveMap } from './LiveMap';

interface LiveRunViewProps {
  status: RunStatus;
  countdownValue: number | null;
  isAutoPaused: boolean;
  workoutMode: WorkoutMode;
  goalDistanceKm: GoalDistanceKm;
  intervalPhase: IntervalPhase;
  intervalSecondsLeft: number;
  currentPosition: [number, number];
  accuracyMeters: number | null;
  signalQuality: GpsSignalQuality;
  isCalibrated: boolean;
  durationSeconds: number;
  distanceKm: number;
  currentPaceSecPerKm: number;
  currentSpeedKmh: number;
  path: GeoPoint[];
  splits: Split[];
  isWakeLockActive: boolean;
  voiceCoachEnabled: boolean;
  autoPauseEnabled: boolean;
  weightKg: number;
  unit: UnitSystem;
  accent: AccentTheme;
  onSkipCountdown: () => void;
  onSelectWorkoutMode: (mode: WorkoutMode) => void;
  onSelectGoalDistance: (goalKm: GoalDistanceKm) => void;
  onCalibratePosition: (lat: number, lng: number) => void;
  onResetCalibration: () => void;
  onToggleVoiceCoach: (enabled: boolean) => void;
  onToggleAutoPause: (enabled: boolean) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}

export const LiveRunView: React.FC<LiveRunViewProps> = ({
  status,
  countdownValue,
  isAutoPaused,
  workoutMode,
  goalDistanceKm,
  intervalPhase,
  intervalSecondsLeft,
  currentPosition,
  accuracyMeters,
  signalQuality,
  isCalibrated,
  durationSeconds,
  distanceKm,
  currentPaceSecPerKm,
  currentSpeedKmh,
  path,
  splits,
  isWakeLockActive,
  voiceCoachEnabled,
  autoPauseEnabled,
  weightKg,
  unit,
  accent,
  onSkipCountdown,
  onSelectWorkoutMode,
  onSelectGoalDistance,
  onCalibratePosition,
  onResetCalibration,
  onToggleVoiceCoach,
  onToggleAutoPause,
  onStart,
  onPause,
  onResume,
  onFinish,
}) => {
  const palette = ACCENT_PALETTES[accent];
  const [showSecondaryDrawer, setShowSecondaryDrawer] = useState(false);
  const [liveHeatmap, setLiveHeatmap] = useState(false);
  const [centerTrigger, setCenterTrigger] = useState(0);

  // Estado para "Modo Bolsillo / Pantalla Negra OLED"
  const [isPocketMode, setIsPocketMode] = useState(false);
  const [unlockProgress, setUnlockProgress] = useState(0);
  const unlockTimerRef = useRef<number | null>(null);
  const [wallClockTime, setWallClockTime] = useState(() =>
    new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })
  );

  // Estado para el botón "Mantener presionado para Finalizar" (Hold-to-stop)
  const [holdProgress, setHoldProgress] = useState(0);
  const holdTimerRef = useRef<number | null>(null);

  // Salir automáticamente del Modo Bolsillo si termina la sesión
  useEffect(() => {
    if (status === 'idle' && isPocketMode) {
      setIsPocketMode(false);
      setUnlockProgress(0);
    }
  }, [status, isPocketMode]);

  // Actualizar reloj tenue en Modo Bolsillo
  useEffect(() => {
    if (!isPocketMode) return;
    setWallClockTime(
      new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      })
    );
    const clockInterval = window.setInterval(() => {
      setWallClockTime(
        new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    }, 10000);
    return () => clearInterval(clockInterval);
  }, [isPocketMode]);

  const startHoldToUnlockPocket = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (unlockTimerRef.current) clearInterval(unlockTimerRef.current);
    const startTime = Date.now();
    const holdDurationMs = 1500; // 1.5 segundos exactos para desbloquear

    unlockTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / holdDurationMs) * 100);
      setUnlockProgress(pct);
      if (pct >= 100) {
        if (unlockTimerRef.current) clearInterval(unlockTimerRef.current);
        unlockTimerRef.current = null;
        setUnlockProgress(0);
        setIsPocketMode(false);
      }
    }, 25);
  };

  const cancelHoldToUnlockPocket = (e?: React.SyntheticEvent) => {
    if (e) e.stopPropagation();
    if (unlockTimerRef.current) {
      clearInterval(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
    setUnlockProgress(0);
  };

  const startHoldToFinish = () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    const startTime = Date.now();
    const holdDurationMs = 1150;

    holdTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / holdDurationMs) * 100);
      setHoldProgress(pct);
      if (pct >= 100) {
        if (holdTimerRef.current) clearInterval(holdTimerRef.current);
        holdTimerRef.current = null;
        setHoldProgress(0);
        onFinish();
      }
    }, 25);
  };

  const cancelHoldToFinish = () => {
    if (holdTimerRef.current) {
      clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setHoldProgress(0);
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearInterval(holdTimerRef.current);
      if (unlockTimerRef.current) clearInterval(unlockTimerRef.current);
    };
  }, []);

  // Indicador dinámico único de señal GPS mostrando metros exactos de precisión
  const signalMeta = {
    excellent: {
      dotClass: 'bg-[#00F5A0]',
      label: `GPS Conectado ${accuracyMeters ? `(±${accuracyMeters}m)` : ''}`,
    },
    good: {
      dotClass: 'bg-emerald-400',
      label: `GPS Conectado ${accuracyMeters ? `(±${accuracyMeters}m)` : ''}`,
    },
    poor: {
      dotClass: 'bg-amber-400',
      label: `GPS Conectado ${accuracyMeters ? `(±${accuracyMeters}m)` : ''}`,
    },
    searching: {
      dotClass: 'bg-amber-500',
      label: 'Buscando GPS...',
    },
  }[signalQuality];

  // Cálculos de progreso para Modo Meta de Distancia
  const goalProgressPct = Math.min(100, (distanceKm / goalDistanceKm) * 100);
  const remainingGoalMeters = Math.max(
    0,
    Math.round((goalDistanceKm - distanceKm) * 1000)
  );

  return (
    <div className="relative w-full h-[100dvh] min-h-[100dvh] overflow-hidden bg-[#090A0F]">
      {/* 1. MAPA INTERACTIVO 100% PANTALLA */}
      <LiveMap
        currentPosition={currentPosition}
        path={path}
        accent={accent}
        fitBoundsMode={false}
        paceHeatmap={liveHeatmap}
        interactive={true}
        canCalibrate={status === 'idle' || status === 'paused'}
        isCalibrated={isCalibrated}
        centerTrigger={centerTrigger}
        onRequestCenter={() => setCenterTrigger((prev) => prev + 1)}
        onCalibratePosition={onCalibratePosition}
        onResetCalibration={onResetCalibration}
      />

      {/* OVERLAY MODO BOLSILLO / PANTALLA NEGRA OLED (#000000 PURO PARA AHORRO DE BATERÍA) */}
      {isPocketMode && (
        <div
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="fixed inset-0 z-[100] h-[100dvh] min-h-[100dvh] bg-[#000000] flex flex-col items-center justify-between py-14 px-6 select-none touch-none"
          style={{
            paddingTop: 'max(3.5rem, env(safe-area-inset-top))',
            paddingBottom: 'max(3.5rem, env(safe-area-inset-bottom))',
          }}
        >
          {/* Hora actual en gris muy oscuro */}
          <div className="flex flex-col items-center gap-1 text-zinc-700">
            <span className="font-display text-3xl font-bold tabular-nums tracking-widest text-zinc-600">
              {wallClockTime}
            </span>
          </div>

          {/* Distancia y Ritmo en gris muy oscuro (mínimo consumo OLED manteniendo WakeLock) */}
          <div className="flex flex-col items-center text-center my-auto gap-8">
            <div className="flex flex-col items-center">
              <div className="font-display text-7xl font-extrabold text-zinc-700 tabular-nums tracking-tight leading-none">
                {formatDistance(distanceKm, unit)}
              </div>
              <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-800 mt-2">
                Distancia ({unit})
              </span>
            </div>

            <div className="flex flex-col items-center">
              <div className="font-display text-5xl font-bold text-zinc-700 tabular-nums tracking-tight leading-none">
                {formatPace(currentPaceSecPerKm, unit)}
              </div>
              <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-800 mt-2">
                Ritmo ({unit === 'km' ? 'min/km' : 'min/mi'})
              </span>
            </div>
          </div>

          {/* Botón central tenue: Mantener presionado 1.5s para desbloquear */}
          <div className="w-full max-w-xs flex flex-col items-center gap-2">
            <button
              onMouseDown={startHoldToUnlockPocket}
              onMouseUp={cancelHoldToUnlockPocket}
              onMouseLeave={cancelHoldToUnlockPocket}
              onTouchStart={startHoldToUnlockPocket}
              onTouchEnd={cancelHoldToUnlockPocket}
              onTouchCancel={cancelHoldToUnlockPocket}
              className="relative overflow-hidden w-full py-4 px-5 rounded-2xl bg-zinc-950 border border-zinc-900 text-zinc-600 font-display font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 select-none active:scale-[0.99] transition"
            >
              <div
                className="absolute inset-y-0 left-0 bg-zinc-800/60 transition-all duration-75"
                style={{ width: `${unlockProgress}%` }}
              />
              <Unlock className="w-4 h-4 relative z-10" />
              <span className="relative z-10">
                Mantén presionado 1.5s para desbloquear
              </span>
            </button>
          </div>
        </div>
      )}

      {/* OVERLAY MINIMALISTA DE CUENTA REGRESIVA (3... 2... 1... ¡YA!) */}
      {countdownValue !== null && (
        <div
          onClick={onSkipCountdown}
          className="fixed inset-0 z-[100] h-[100dvh] min-h-[100dvh] flex flex-col items-center justify-center bg-[#090A0F]/90 backdrop-blur-2xl cursor-pointer select-none"
        >
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-400 mb-4">
            Preparando Salida
          </span>
          <div
            key={countdownValue}
            style={{ textShadow: palette.shadowStyle }}
            className={`font-display text-[130px] sm:text-[160px] font-extrabold leading-none tabular-nums ${palette.textClass} animate-bounce`}
          >
            {countdownValue > 0 ? countdownValue : '¡YA!'}
          </div>
          <span className="mt-10 text-xs text-zinc-500 hover:text-zinc-300 transition border border-white/10 rounded-full px-4 py-1.5 bg-white/5">
            Toca la pantalla para saltar cuenta regresiva
          </span>
        </div>
      )}

      {/* 2. BARRA SUPERIOR FLOTANTE: Únicamente Indicador Dinámico GPS Conectado (±Xm) + Audio Coach */}
      <header className="absolute top-0 left-0 right-0 z-50 px-4 pt-4 flex items-center justify-between gap-2 pointer-events-none">
        {/* Indicador minimalista de calidad GPS */}
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-[#10121A]/85 backdrop-blur-xl border border-white/10 px-3.5 py-2 shadow-lg">
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${signalMeta.dotClass}`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${signalMeta.dotClass}`}
            />
          </span>
          <span className="text-xs font-medium text-zinc-200 tracking-tight">
            {signalMeta.label}
          </span>
          {isWakeLockActive && (
            <span
              title="Pantalla siempre activa (Wake Lock)"
              className="ml-0.5 text-[10px] text-zinc-400 flex items-center gap-0.5 border-l border-white/10 pl-2"
            >
              <Smartphone className="w-3 h-3 text-[#00F5A0]" />
            </span>
          )}
        </div>

        {/* Control Superior Derecha: Entrenador de Voz */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => onToggleVoiceCoach(!voiceCoachEnabled)}
            className={`flex items-center justify-center w-9 h-9 rounded-full bg-[#10121A]/85 backdrop-blur-xl border border-white/10 transition active:scale-95 shadow-lg ${
              voiceCoachEnabled
                ? palette.textClass
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            title={
              voiceCoachEnabled
                ? 'Entrenador de voz activo (clic para silenciar)'
                : 'Entrenador de voz silenciado (clic para activar)'
            }
            aria-label="Alternar entrenador de voz"
          >
            {voiceCoachEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>
        </div>
      </header>

      {/* 3. HUD FLOTANTE INFERIOR ("INICIAR CARRERA") + SELECTOR DE MODO DE CARRERA */}
      <section className="absolute bottom-20 left-0 right-0 z-50 px-4 pointer-events-none flex flex-col items-center">
        {/* BADGE ÁMBAR PULSANTE DE AUTO-PAUSA EN SEMÁFOROS */}
        {status === 'running' && isAutoPaused && (
          <div className="pointer-events-auto mb-2.5 rounded-full bg-amber-500/20 backdrop-blur-xl border border-amber-400/40 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-300 shadow-lg animate-pulse">
            ⏸ AUTO-PAUSA (EN ESPERA DE MOVIMIENTO)
          </div>
        )}

        {/* PÍLDORAS DE SELECCIÓN DE MODO DE CARRERA (Visible antes de Iniciar Carrera) */}
        {status === 'idle' && (
          <div className="pointer-events-auto mb-2.5 flex flex-col items-center gap-2 w-full max-w-md">
            <div className="inline-flex items-center gap-1 rounded-full bg-[#10121A]/90 backdrop-blur-xl border border-white/10 p-1 shadow-xl">
              <button
                onClick={() => onSelectWorkoutMode('free')}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  workoutMode === 'free'
                    ? `${palette.bgClass} text-[#090A0F]`
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>Libre</span>
              </button>

              <button
                onClick={() => onSelectWorkoutMode('goal')}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  workoutMode === 'goal'
                    ? `${palette.bgClass} text-[#090A0F]`
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Meta ({goalDistanceKm}K)</span>
              </button>

              <button
                onClick={() => onSelectWorkoutMode('intervals')}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  workoutMode === 'intervals'
                    ? `${palette.bgClass} text-[#090A0F]`
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Intervalos 1&apos;/1&apos;</span>
              </button>
            </div>

            {workoutMode === 'goal' && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#10121A]/90 backdrop-blur-xl border border-white/10 px-2.5 py-1 shadow-lg">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 px-1">
                  Objetivo:
                </span>
                {([3, 5, 10] as GoalDistanceKm[]).map((km) => (
                  <button
                    key={km}
                    onClick={() => onSelectGoalDistance(km)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold tabular-nums transition ${
                      goalDistanceKm === km
                        ? `${palette.bgClass} text-[#090A0F]`
                        : 'text-zinc-400 hover:text-white bg-white/5'
                    }`}
                  >
                    {km}K
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TARJETA HUD PRINCIPAL */}
        <div className="pointer-events-auto w-full max-w-md rounded-[28px] bg-[#10121A]/85 backdrop-blur-2xl border border-white/10 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.75)] transition-all duration-300">
          {/* Píldora sutil de estado, Modo Bolsillo OLED y botón de detalles */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  status === 'running' && !isAutoPaused
                    ? `${palette.bgClass} animate-pulse`
                    : status === 'paused' || isAutoPaused
                    ? 'bg-amber-400'
                    : 'bg-zinc-600'
                }`}
              />
              <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-zinc-400">
                {status === 'running'
                  ? isAutoPaused
                    ? 'Auto-Pausa Activa'
                    : workoutMode === 'goal'
                    ? `Meta ${goalDistanceKm}K en curso`
                    : workoutMode === 'intervals'
                    ? "Fartlek 1' / 1'"
                    : 'En Carrera'
                  : status === 'paused'
                  ? 'En Pausa'
                  : workoutMode === 'goal'
                  ? `Modo Meta ${goalDistanceKm}K`
                  : workoutMode === 'intervals'
                  ? 'Modo Intervalos Fartlek'
                  : 'Listo para salir'}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {(status === 'running' || status === 'paused') && (
                <button
                  onClick={() => setIsPocketMode(true)}
                  className="flex items-center gap-1 text-[11px] font-medium text-zinc-200 hover:text-white transition px-2.5 py-1 rounded-full bg-white/10 border border-white/15 active:scale-95"
                  title="Activar Modo Bolsillo (Pantalla Negra OLED ahorradora de batería)"
                >
                  <Lock className={`w-3 h-3 ${palette.textClass}`} />
                  <span>Modo Bolsillo</span>
                </button>
              )}

              <button
                onClick={() => setShowSecondaryDrawer((prev) => !prev)}
                className="flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-white transition px-2 py-0.5 rounded-full bg-white/5"
              >
                <span>Detalles</span>
                {showSecondaryDrawer ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* INDICADOR VISUAL DE MODO META (3K / 5K / 10K) */}
          {workoutMode === 'goal' && (
            <div className="mb-3 rounded-2xl bg-white/[0.04] border border-white/5 px-3.5 py-2">
              <div className="flex items-center justify-between text-[11px] mb-1.5">
                <span className="font-semibold text-zinc-300">
                  Progreso hacia {goalDistanceKm} km
                </span>
                <span className={`font-bold tabular-nums ${palette.textClass}`}>
                  {remainingGoalMeters > 0
                    ? `Faltan ${
                        remainingGoalMeters >= 1000
                          ? `${(remainingGoalMeters / 1000).toFixed(2)} km`
                          : `${remainingGoalMeters} m`
                      }`
                    : '¡Meta Alcanzada!'}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${palette.bgClass}`}
                  style={{ width: `${goalProgressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* INDICADOR VISUAL DE INTERVALOS (Fartlek 1' Rápido / 1' Suave) */}
          {workoutMode === 'intervals' && (
            <div
              className={`mb-3 rounded-2xl border px-3.5 py-2 flex items-center justify-between transition-colors ${
                intervalPhase === 'fast'
                  ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                  : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  {intervalPhase === 'fast'
                    ? '¡Ritmo Rápido! (1 min)'
                    : 'Recuperación Suave (1 min)'}
                </span>
              </div>
              <span className="font-display font-extrabold text-sm tabular-nums">
                00:{intervalSecondsLeft.toString().padStart(2, '0')}
              </span>
            </div>
          )}

          {/* PROTAGONISTA VISUAL CENTRAL: Ritmo Actual en Tipografía Gigante Tabular */}
          <div className="text-center my-2">
            <div
              className={`font-display text-6xl sm:text-7xl font-extrabold tracking-tight tabular-nums leading-none ${
                status === 'running' ? 'text-white' : 'text-zinc-200'
              }`}
            >
              {formatPace(currentPaceSecPerKm, unit)}
            </div>
            <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">
              Ritmo Actual ({unit === 'km' ? 'min/km' : 'min/mi'})
            </p>
          </div>

          {/* DOS MÉTRICAS SECUNDARIAS LIMPIAS: Distancia y Tiempo */}
          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center border-r border-white/10 pr-2">
              <span className="font-display text-2xl sm:text-3xl font-bold text-white tabular-nums tracking-tight">
                {formatDistance(distanceKm, unit)}
              </span>
              <span className="text-[11px] uppercase tracking-[0.15em] text-zinc-400 mt-0.5">
                Distancia ({unit})
              </span>
            </div>

            <div className="flex flex-col items-center pl-2">
              <span className="font-display text-2xl sm:text-3xl font-bold text-white tabular-nums tracking-tight">
                {formatDuration(durationSeconds)}
              </span>
              <span className="text-[11px] uppercase tracking-[0.15em] text-zinc-400 mt-0.5">
                Tiempo
              </span>
            </div>
          </div>

          {/* ACORDEÓN OCULTO DE DATOS SECUNDARIOS + AUTO-PAUSA Y TRAZO POR RITMO */}
          {showSecondaryDrawer && (
            <div className="mt-4 pt-3 border-t border-white/10 text-xs text-zinc-300 space-y-2.5 animate-fadeIn">
              <div className="flex items-center justify-between text-zinc-400">
                <span>Velocidad instantánea</span>
                <span className="font-semibold text-white tabular-nums">
                  {currentSpeedKmh.toFixed(1)} km/h
                </span>
              </div>
              <div className="flex items-center justify-between text-zinc-400">
                <span>Calorías metabólicas ({weightKg} kg)</span>
                <span className="font-semibold text-white tabular-nums">
                  {calculateMetabolicCalories(distanceKm, weightKg)} kcal
                </span>
              </div>

              {/* Toggles sutiles: Auto-Pausa en Semáforos y Mapa de Calor por Ritmo */}
              <div className="pt-1 flex items-center justify-between gap-2">
                <button
                  onClick={() => onToggleAutoPause(!autoPauseEnabled)}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl border text-[11px] font-semibold transition flex items-center justify-between ${
                    autoPauseEnabled
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-white/[0.02] border-white/5 text-zinc-500'
                  }`}
                >
                  <span>Auto-Pausa</span>
                  <span className={autoPauseEnabled ? palette.textClass : ''}>
                    {autoPauseEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>

                <button
                  onClick={() => setLiveHeatmap((prev) => !prev)}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl border text-[11px] font-semibold transition flex items-center justify-between ${
                    liveHeatmap
                      ? 'bg-white/10 border-white/20 text-white'
                      : 'bg-white/[0.02] border-white/5 text-zinc-500'
                  }`}
                >
                  <span>Color por Ritmo</span>
                  <span className={liveHeatmap ? palette.textClass : ''}>
                    {liveHeatmap ? 'ON' : 'OFF'}
                  </span>
                </button>
              </div>

              {splits.length > 0 && (
                <div className="pt-1">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 block mb-1">
                    Último Parcial (Km {splits[splits.length - 1].kmIndex})
                  </span>
                  <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-1.5">
                    <span className="text-zinc-300 font-medium">
                      Kilómetro {splits[splits.length - 1].kmIndex}
                    </span>
                    <span
                      className={`font-bold tabular-nums ${palette.textClass}`}
                    >
                      {formatPace(
                        splits[splits.length - 1].paceSecondsPerKm,
                        unit
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONTROLES TÁCTILES GRANDES */}
          <div className="mt-5 flex items-center justify-center gap-4">
            {status === 'idle' && (
              <button
                onClick={onStart}
                style={{ boxShadow: palette.shadowStyle }}
                className={`w-full py-4 rounded-2xl ${palette.bgClass} text-[#090A0F] font-display font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2.5 active:scale-[0.98] transition`}
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Iniciar Carrera</span>
              </button>
            )}

            {status === 'running' && (
              <>
                <button
                  onClick={onPause}
                  className="flex-1 py-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-display font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition"
                >
                  <Pause className="w-5 h-5" />
                  <span>Pausar</span>
                </button>

                <button
                  onMouseDown={startHoldToFinish}
                  onMouseUp={cancelHoldToFinish}
                  onMouseLeave={cancelHoldToFinish}
                  onTouchStart={startHoldToFinish}
                  onTouchEnd={cancelHoldToFinish}
                  className="relative overflow-hidden flex-1 py-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 select-none active:scale-[0.98] transition"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-rose-500/40 transition-all duration-75"
                    style={{ width: `${holdProgress}%` }}
                  />
                  <Square className="w-4 h-4 fill-current relative z-10" />
                  <span className="relative z-10">
                    {holdProgress > 0 ? 'Mantén...' : 'Mantén Fin'}
                  </span>
                </button>
              </>
            )}

            {status === 'paused' && (
              <>
                <button
                  onClick={onResume}
                  style={{ boxShadow: palette.shadowStyle }}
                  className={`flex-1 py-4 rounded-2xl ${palette.bgClass} text-[#090A0F] font-display font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition`}
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>Reanudar</span>
                </button>

                <button
                  onMouseDown={startHoldToFinish}
                  onMouseUp={cancelHoldToFinish}
                  onMouseLeave={cancelHoldToFinish}
                  onTouchStart={startHoldToFinish}
                  onTouchEnd={cancelHoldToFinish}
                  className="relative overflow-hidden flex-1 py-4 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-200 font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 select-none active:scale-[0.98] transition"
                >
                  <div
                    className="absolute inset-y-0 left-0 bg-rose-500/50 transition-all duration-75"
                    style={{ width: `${holdProgress}%` }}
                  />
                  <Square className="w-4 h-4 fill-current relative z-10" />
                  <span className="relative z-10">
                    {holdProgress > 0 ? 'Soltar cancela' : 'Mantén Fin'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

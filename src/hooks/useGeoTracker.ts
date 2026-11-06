import { useState, useEffect, useRef, useCallback } from 'react';
import {
  GeoPoint,
  GoalDistanceKm,
  GpsSignalQuality,
  IntervalPhase,
  PermissionStateStatus,
  RunActivity,
  RunStatus,
  Split,
  UnitSystem,
  WorkoutMode,
} from '../types/run';
import {
  calculateRollingPaceSecondsPerKm,
  computeSplitsFromPath,
  isValidGpsStep,
} from '../utils/geoMath';
import { calculateMetabolicCalories } from '../utils/storage';
import { useWakeLock } from './useWakeLock';
import { useAudioCoach } from './useAudioCoach';

// Coordenada inicial por defecto (Bosque de Chapultepec / CDMX) antes del primer fix
const DEFAULT_CENTER: [number, number] = [19.4204, -99.1819];
const CALIBRATED_HOME_STORAGE_KEY = 'stride_calibrated_home';
const KM_TO_MILES = 0.621371;

function loadCalibratedHome(): [number, number] | null {
  try {
    const raw = localStorage.getItem(CALIBRATED_HOME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.lat === 'number' &&
      typeof parsed.lng === 'number'
    ) {
      return [parsed.lat, parsed.lng];
    }
    return null;
  } catch {
    return null;
  }
}

interface UseGeoTrackerOptions {
  voiceCoachEnabled: boolean;
  autoPauseEnabled: boolean;
  weightKg: number;
  unit: UnitSystem;
  onRunCompleted: (activity: RunActivity) => void;
}

export function useGeoTracker({
  voiceCoachEnabled,
  autoPauseEnabled,
  weightKg,
  unit,
  onRunCompleted,
}: UseGeoTrackerOptions) {
  const initialSavedHome = loadCalibratedHome();

  const [status, setStatus] = useState<RunStatus>('idle');
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [isAutoPaused, setIsAutoPaused] = useState<boolean>(false);

  const [workoutMode, setWorkoutMode] = useState<WorkoutMode>('free');
  const [goalDistanceKm, setGoalDistanceKm] = useState<GoalDistanceKm>(5);

  const [permissionState, setPermissionState] =
    useState<PermissionStateStatus>('prompt');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionErrorMsg, setPermissionErrorMsg] = useState<string | null>(
    null
  );

  const [currentPosition, setCurrentPosition] = useState<[number, number]>(
    initialSavedHome ?? DEFAULT_CENTER
  );
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  const [signalQuality, setSignalQuality] =
    useState<GpsSignalQuality>('searching');
  const [isCalibrated, setIsCalibrated] = useState<boolean>(
    initialSavedHome !== null
  );

  // Métricas en tiempo real
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [currentPaceSecPerKm, setCurrentPaceSecPerKm] = useState(0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [path, setPath] = useState<GeoPoint[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);

  // Mantener pantalla encendida mientras se corre (con re-adquisición en visibilitychange)
  const { isWakeLockActive } = useWakeLock(status === 'running');

  // Entrenador de voz en tiempo real (Web Speech API)
  const audioCoach = useAudioCoach(voiceCoachEnabled);

  // Referencias mutables estables para evitar re-creación de callbacks y bucles en useEffect
  const statusRef = useRef<RunStatus>(status);
  statusRef.current = status;

  const isAutoPausedRef = useRef<boolean>(isAutoPaused);
  isAutoPausedRef.current = isAutoPaused;

  const autoPauseEnabledRef = useRef<boolean>(autoPauseEnabled);
  autoPauseEnabledRef.current = autoPauseEnabled;

  const weightKgRef = useRef<number>(weightKg);
  weightKgRef.current = weightKg;

  const workoutModeRef = useRef<WorkoutMode>(workoutMode);
  workoutModeRef.current = workoutMode;

  const goalDistanceKmRef = useRef<GoalDistanceKm>(goalDistanceKm);
  goalDistanceKmRef.current = goalDistanceKm;

  const unitRef = useRef<UnitSystem>(unit);
  unitRef.current = unit;

  const audioCoachRef = useRef(audioCoach);
  audioCoachRef.current = audioCoach;

  const pathRef = useRef<GeoPoint[]>([]);
  const distanceRef = useRef<number>(0);
  const lastMovementTimeRef = useRef<number>(Date.now());
  const countdownTimerRef = useRef<number | null>(null);

  // Timestamps reales para recuperación exacta de tiempo si el usuario minimiza la app en el móvil
  const startTimestampRef = useRef<number | null>(null);
  const accumulatedPausedMsRef = useRef<number>(0);
  const pauseStartedAtRef = useRef<number | null>(null);
  const lastIntervalMinuteAnnouncedRef = useRef<number>(0);

  // Coordenada cruda del sensor vs coordenada calibrada con Pin Lock anti-deriva Wi-Fi
  const rawPositionRef = useRef<[number, number]>(
    initialSavedHome ?? DEFAULT_CENTER
  );
  const currentPosRef = useRef<[number, number]>(
    initialSavedHome ?? DEFAULT_CENTER
  );
  const calibratedHomeRef = useRef<[number, number] | null>(initialSavedHome);
  const pinLockRef = useRef<boolean>(initialSavedHome !== null);
  const calibrationOffsetRef = useRef<{ latOffset: number; lngOffset: number }>({
    latOffset: 0,
    lngOffset: 0,
  });

  // Buffer de las 3 lecturas satelitales más recientes (accuracy <= 20m) para promedio ponderado
  const recentFineFixesRef = useRef<
    Array<{ lat: number; lng: number; accuracy: number }>
  >([]);

  const watchIdRef = useRef<number | null>(null);
  const lastAnnouncedMilestoneRef = useRef<number>(0);
  const lastThrottleTimeRef = useRef<number>(0);
  const lastAccuracyRef = useRef<number | null>(null);
  const hasInitialFixRef = useRef<boolean>(false);

  // Banderas para avisos de Meta de Distancia (50%, últimos 500m y 100%)
  const goalHalfwayAnnouncedRef = useRef<boolean>(false);
  const goal500mAnnouncedRef = useRef<boolean>(false);
  const goalCompletedAnnouncedRef = useRef<boolean>(false);

  // Calcula los segundos efectivos exactos usando Date.now() y descontando pausas
  const computeEffectiveDurationSec = useCallback((nowMs: number): number => {
    if (startTimestampRef.current === null) return 0;
    const activePauseMs =
      pauseStartedAtRef.current !== null
        ? Math.max(0, nowMs - pauseStartedAtRef.current)
        : 0;
    const effectiveMs =
      nowMs -
      startTimestampRef.current -
      accumulatedPausedMsRef.current -
      activePauseMs;
    return Math.max(0, Math.floor(effectiveMs / 1000));
  }, []);

  // Evaluar calidad de señal según metros de precisión
  const updateSignalQuality = useCallback((acc: number | null) => {
    if (acc === null) {
      setSignalQuality((prev) => (prev === 'searching' ? prev : 'searching'));
    } else if (acc <= 15) {
      setSignalQuality((prev) => (prev === 'excellent' ? prev : 'excellent'));
    } else if (acc <= 40) {
      setSignalQuality((prev) => (prev === 'good' ? prev : 'good'));
    } else {
      setSignalQuality((prev) => (prev === 'poor' ? prev : 'poor'));
    }
  }, []);

  // Calibración manual con Pin Lock y persistencia en localStorage (stride_calibrated_home)
  const calibratePosition = useCallback((targetLat: number, targetLng: number) => {
    if (statusRef.current !== 'idle' && statusRef.current !== 'paused') return;

    const [rawLat, rawLng] = rawPositionRef.current;
    calibrationOffsetRef.current = {
      latOffset: targetLat - rawLat,
      lngOffset: targetLng - rawLng,
    };

    calibratedHomeRef.current = [targetLat, targetLng];
    pinLockRef.current = statusRef.current === 'idle';
    currentPosRef.current = [targetLat, targetLng];
    setCurrentPosition([targetLat, targetLng]);
    setIsCalibrated(true);

    try {
      localStorage.setItem(
        CALIBRATED_HOME_STORAGE_KEY,
        JSON.stringify({ lat: targetLat, lng: targetLng })
      );
    } catch {
      // ignore
    }

    if (statusRef.current === 'paused' && pathRef.current.length > 0) {
      const updated = [...pathRef.current];
      const lastIdx = updated.length - 1;
      updated[lastIdx] = {
        ...updated[lastIdx],
        lat: targetLat,
        lng: targetLng,
        timestamp: Date.now(),
      };
      pathRef.current = updated;
      setPath(updated);
    }
  }, []);

  // Botón "🎯 Restablecer a GPS": borra la calibración guardada y vuelve a la lectura real del sensor
  const resetCalibration = useCallback(() => {
    try {
      localStorage.removeItem(CALIBRATED_HOME_STORAGE_KEY);
    } catch {
      // ignore
    }

    calibratedHomeRef.current = null;
    pinLockRef.current = false;
    calibrationOffsetRef.current = { latOffset: 0, lngOffset: 0 };
    setIsCalibrated(false);

    const [rawLat, rawLng] = rawPositionRef.current;
    currentPosRef.current = [rawLat, rawLng];
    setCurrentPosition([rawLat, rawLng]);
  }, []);

  // Procesar coordenada GPS real con Desbloqueo Automático al Correr, Offset Inteligente y Seguimiento Continuo
  const ingestCoordinate = useCallback(
    (
      incomingRawLat: number,
      incomingRawLng: number,
      accuracy: number,
      forceImmediate = false
    ) => {
      const now = Date.now();
      let refinedRawLat = incomingRawLat;
      let refinedRawLng = incomingRawLng;

      // Refinamiento Satelital Continuo: Cuando accuracy <= 20m, promediar las 3 lecturas más recientes ponderadas por 1/(accuracy^2)
      if (accuracy <= 20) {
        const clampedAcc = Math.max(accuracy, 1);
        const nextBuffer = [
          ...recentFineFixesRef.current.slice(-2),
          { lat: incomingRawLat, lng: incomingRawLng, accuracy: clampedAcc },
        ];
        recentFineFixesRef.current = nextBuffer;

        let sumWeights = 0;
        let weightedLat = 0;
        let weightedLng = 0;
        for (const fix of nextBuffer) {
          const w = 1 / (fix.accuracy * fix.accuracy);
          sumWeights += w;
          weightedLat += fix.lat * w;
          weightedLng += fix.lng * w;
        }
        if (sumWeights > 0) {
          refinedRawLat = weightedLat / sumWeights;
          refinedRawLng = weightedLng / sumWeights;
        }
      }

      rawPositionRef.current = [refinedRawLat, refinedRawLng];

      const roundedAcc = Math.round(accuracy);
      setAccuracyMeters((prev) => (prev === roundedAcc ? prev : roundedAcc));
      updateSignalQuality(accuracy);

      // 1. BLOQUEO DE DERIVA (Pin Lock): SOLO ACTIVO EN ESTADO 'idle'
      // En cuanto la carrera pasa a 'running', el Pin Lock queda 100% desactivado.
      if (
        statusRef.current === 'idle' &&
        pinLockRef.current &&
        calibratedHomeRef.current !== null
      ) {
        const [homeLat, homeLng] = calibratedHomeRef.current;
        calibrationOffsetRef.current = {
          latOffset: homeLat - refinedRawLat,
          lngOffset: homeLng - refinedRawLng,
        };

        if (accuracy > 25) {
          hasInitialFixRef.current = true;
          lastThrottleTimeRef.current = now;
          lastAccuracyRef.current = accuracy;
          const [curLat, curLng] = currentPosRef.current;
          if (
            Math.abs(curLat - homeLat) > 0.000001 ||
            Math.abs(curLng - homeLng) > 0.000001
          ) {
            currentPosRef.current = [homeLat, homeLng];
            setCurrentPosition([homeLat, homeLng]);
          }
          return;
        }
      }

      // 2. CALIBRATION OFFSET INTELIGENTE EN MOVIMIENTO:
      // Si la carrera está en 'running' y el GPS satelital del móvil ya tiene buena precisión (accuracy <= 20m),
      // usamos directamente las coordenadas reales del satélite al avanzar para no arrastrar un offset artificial de Wi-Fi.
      if (statusRef.current === 'running' && accuracy <= 20) {
        calibrationOffsetRef.current = { latOffset: 0, lngOffset: 0 };
      }

      const lat = refinedRawLat + calibrationOffsetRef.current.latOffset;
      const lng = refinedRawLng + calibrationOffsetRef.current.lngOffset;

      const hasBetterAccuracy =
        lastAccuracyRef.current === null || accuracy < lastAccuracyRef.current;

      if (
        !forceImmediate &&
        !hasBetterAccuracy &&
        hasInitialFixRef.current &&
        now - lastThrottleTimeRef.current < 950
      ) {
        return;
      }

      const [prevLat, prevLng] = currentPosRef.current;
      const coordsChanged =
        !hasInitialFixRef.current ||
        hasBetterAccuracy ||
        Math.abs(lat - prevLat) > 0.000003 ||
        Math.abs(lng - prevLng) > 0.000003;

      lastThrottleTimeRef.current = now;
      lastAccuracyRef.current = accuracy;
      hasInitialFixRef.current = true;

      if (coordsChanged) {
        currentPosRef.current = [lat, lng];
        setCurrentPosition([lat, lng]);
      }

      // Si no está corriendo activamente, solo mantenemos la ubicación actual y señal listas
      if (statusRef.current !== 'running') return;

      const currentPath = pathRef.current;

      // Anclaje del Punto 0: si por alguna razón aún no había punto 0, fijarlo aquí
      if (currentPath.length === 0) {
        lastMovementTimeRef.current = now;
        const firstPoint: GeoPoint = {
          lat,
          lng,
          timestamp: now,
          accuracy,
          speed: 0,
          cumulativeDistanceKm: 0,
        };
        pathRef.current = [firstPoint];
        setPath([firstPoint]);
        return;
      }

      // 3. VALIDACIÓN DE TRAZADO REAL EN CALLE:
      // Acepta lecturas satelitales móviles (accuracy <= 65m) con desplazamiento >= 1.8m respecto al último punto guardado
      const lastPoint = currentPath[currentPath.length - 1];
      const validation = isValidGpsStep(
        lastPoint,
        lat,
        lng,
        now,
        accuracy,
        false
      );

      if (!validation.valid) {
        return;
      }

      const speedKmh = validation.speedMs * 3.6;

      // Se detectó avance real (>= 1.8m de desplazamiento)
      lastMovementTimeRef.current = now;

      // Si estaba en Auto-Pausa, reanudar automáticamente y acumular el tiempo que estuvo detenido
      if (isAutoPausedRef.current) {
        isAutoPausedRef.current = false;
        setIsAutoPaused(false);
        if (pauseStartedAtRef.current !== null) {
          accumulatedPausedMsRef.current += Math.max(
            0,
            now - pauseStartedAtRef.current
          );
          pauseStartedAtRef.current = null;
        }
        const lastIdx = currentPath.length - 1;
        currentPath[lastIdx] = {
          ...currentPath[lastIdx],
          timestamp: now - 1000,
        };
        audioCoachRef.current.announceAutoResume();
      }

      const newCumulativeKm = distanceRef.current + validation.distanceKm;
      distanceRef.current = newCumulativeKm;

      const nextPoint: GeoPoint = {
        lat,
        lng,
        timestamp: now,
        accuracy,
        speed: validation.speedMs,
        cumulativeDistanceKm: newCumulativeKm,
      };

      const updatedPath = [...currentPath, nextPoint];
      pathRef.current = updatedPath;

      setPath(updatedPath);
      setDistanceKm(newCumulativeKm);
      setCurrentSpeedKmh(speedKmh);

      const rollingPace = calculateRollingPaceSecondsPerKm(updatedPath);
      setCurrentPaceSecPerKm(rollingPace);
      const updatedSplits = computeSplitsFromPath(updatedPath);
      setSplits(updatedSplits);

      // Avisos por voz en Modo Meta de Distancia (50%, últimos 500m, y 100%)
      if (workoutModeRef.current === 'goal') {
        const targetKm = goalDistanceKmRef.current;
        const halfTarget = targetKm * 0.5;
        const last500mTarget = targetKm - 0.5;

        if (
          !goalCompletedAnnouncedRef.current &&
          newCumulativeKm >= targetKm
        ) {
          goalCompletedAnnouncedRef.current = true;
          audioCoachRef.current.announceGoalCompleted(targetKm);
          return;
        }
        if (
          !goal500mAnnouncedRef.current &&
          newCumulativeKm >= last500mTarget &&
          newCumulativeKm < targetKm
        ) {
          goal500mAnnouncedRef.current = true;
          audioCoachRef.current.announceGoalLast500m();
          return;
        }
        if (
          !goalHalfwayAnnouncedRef.current &&
          newCumulativeKm >= halfTarget &&
          newCumulativeKm < last500mTarget
        ) {
          goalHalfwayAnnouncedRef.current = true;
          audioCoachRef.current.announceGoalHalfway(targetKm);
          return;
        }
      }

      // Verificar si se alcanzó un nuevo kilómetro o milla para el Audio Coach
      const activeUnit = unitRef.current;
      const distanceInSelectedUnit =
        activeUnit === 'mi' ? newCumulativeKm * KM_TO_MILES : newCumulativeKm;
      const completedMilestone = Math.floor(distanceInSelectedUnit);

      if (completedMilestone > lastAnnouncedMilestoneRef.current) {
        lastAnnouncedMilestoneRef.current = completedMilestone;
        const paceToAnnounce =
          rollingPace > 0
            ? rollingPace
            : updatedSplits.length > 0
            ? updatedSplits[updatedSplits.length - 1].paceSecondsPerKm
            : 280;
        audioCoachRef.current.announceSplit(
          completedMilestone,
          paceToAnnounce,
          activeUnit
        );
      }
    },
    [updateSignalQuality]
  );

  // Cronómetro exacto basado en Date.now() + Recuperación automática en visibilitychange
  useEffect(() => {
    if (status !== 'running') return;

    const syncDurationAndCheckAutoPause = () => {
      const now = Date.now();

      // Evaluar Auto-Pausa si está habilitada y han pasado más de 6 segundos sin movimiento
      if (
        autoPauseEnabledRef.current &&
        !isAutoPausedRef.current &&
        now - lastMovementTimeRef.current > 6500
      ) {
        isAutoPausedRef.current = true;
        pauseStartedAtRef.current = now;
        setIsAutoPaused(true);
        setCurrentSpeedKmh(0);
        audioCoachRef.current.announceAutoPause();
        return;
      }

      if (isAutoPausedRef.current) {
        return;
      }

      const exactSec = computeEffectiveDurationSec(now);
      setDurationSeconds(exactSec);

      // Avisos por voz de Intervalos Fartlek (1' Rápido / 1' Suave)
      if (workoutModeRef.current === 'intervals' && exactSec >= 60) {
        const minuteIndex = Math.floor(exactSec / 60);
        if (minuteIndex > lastIntervalMinuteAnnouncedRef.current) {
          lastIntervalMinuteAnnouncedRef.current = minuteIndex;
          const nextPhase: IntervalPhase =
            minuteIndex % 2 === 0 ? 'fast' : 'recovery';
          audioCoachRef.current.announceIntervalSwitch(nextPhase);
        }
      }
    };

    const timer = window.setInterval(syncDurationAndCheckAutoPause, 1000);

    // Si el usuario minimizó la app por segundos y vuelve a primer plano, recalcular al instante
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        lastMovementTimeRef.current = Date.now();
        syncDurationAndCheckAutoPause();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [status, computeEffectiveDurationSec]);

  // Si el usuario desactiva Auto-Pausa mientras estaba auto-pausado, reanudar de inmediato
  useEffect(() => {
    if (!autoPauseEnabled && isAutoPaused) {
      const now = Date.now();
      if (pauseStartedAtRef.current !== null) {
        accumulatedPausedMsRef.current += Math.max(
          0,
          now - pauseStartedAtRef.current
        );
        pauseStartedAtRef.current = null;
      }
      isAutoPausedRef.current = false;
      setIsAutoPaused(false);
      lastMovementTimeRef.current = now;
    }
  }, [autoPauseEnabled, isAutoPaused]);

  // Motor GPS Real Permanente con Prioridad de Alta Precisión (enableHighAccuracy: true, maximumAge: 0)
  useEffect(() => {
    if (watchIdRef.current !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (!('geolocation' in navigator)) {
      setPermissionState('denied');
      setPermissionErrorMsg(
        'Tu navegador no soporta geolocalización nativa. Verifica los permisos de ubicación de tu dispositivo.'
      );
      setShowPermissionModal(true);
      return;
    }

    let isCancelled = false;
    hasInitialFixRef.current = false;
    lastAccuracyRef.current = null;
    recentFineFixesRef.current = [];
    setSignalQuality('searching');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (isCancelled) return;
        setPermissionState('granted');
        setPermissionErrorMsg(null);
        ingestCoordinate(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
          true
        );
      },
      (err) => {
        if (isCancelled) return;
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState('denied');
          setPermissionErrorMsg(
            'El permiso de ubicación fue denegado. Actívalo en los ajustes de tu navegador para rastrear tu ruta GPS en vivo.'
          );
          setShowPermissionModal(true);
        } else {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              if (isCancelled) return;
              setPermissionState('granted');
              setPermissionErrorMsg(null);
              ingestCoordinate(
                fallbackPos.coords.latitude,
                fallbackPos.coords.longitude,
                fallbackPos.coords.accuracy,
                true
              );
            },
            () => {
              if (!isCancelled) setSignalQuality('poor');
            },
            {
              enableHighAccuracy: false,
              timeout: 6000,
              maximumAge: 0,
            }
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 0,
      }
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (isCancelled) return;
        setPermissionState('granted');
        setPermissionErrorMsg(null);
        ingestCoordinate(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
          false
        );
      },
      (err) => {
        if (isCancelled) return;
        if (err.code === err.PERMISSION_DENIED) {
          setPermissionState('denied');
          setPermissionErrorMsg(
            'El permiso de ubicación fue denegado. Actívalo en los ajustes de tu navegador para rastrear tu ruta GPS en vivo.'
          );
          setShowPermissionModal(true);
        } else {
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              if (isCancelled) return;
              ingestCoordinate(
                fallbackPos.coords.latitude,
                fallbackPos.coords.longitude,
                fallbackPos.coords.accuracy,
                true
              );
            },
            () => {
              if (!isCancelled) setSignalQuality('poor');
            },
            {
              enableHighAccuracy: false,
              timeout: 6000,
              maximumAge: 0,
            }
          );
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 8000,
      }
    );

    watchIdRef.current = watchId;

    return () => {
      isCancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [ingestCoordinate]);

  // Arrancar carrera inmediatamente tras el 3-2-1: desbloquea Pin Lock y fija points[0]
  const executeStartRunNow = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownValue(null);

    const now = Date.now();
    // Desbloquear Pin Lock en el instante en que inicia la carrera
    pinLockRef.current = false;

    startTimestampRef.current = now;
    accumulatedPausedMsRef.current = 0;
    pauseStartedAtRef.current = null;
    lastIntervalMinuteAnnouncedRef.current = 0;

    // Tomar posición actual (calibrada o GPS) como points[0]
    const [startLat, startLng] = currentPosRef.current;
    const initialPoint: GeoPoint = {
      lat: startLat,
      lng: startLng,
      timestamp: now,
      accuracy: accuracyMeters ?? 15,
      speed: 0,
      cumulativeDistanceKm: 0,
    };

    pathRef.current = [initialPoint];
    distanceRef.current = 0;
    lastMovementTimeRef.current = now;
    lastAnnouncedMilestoneRef.current = 0;
    goalHalfwayAnnouncedRef.current = false;
    goal500mAnnouncedRef.current = false;
    goalCompletedAnnouncedRef.current = false;
    isAutoPausedRef.current = false;

    setIsAutoPaused(false);
    setPath([initialPoint]);
    setDistanceKm(0);
    setDurationSeconds(0);
    setCurrentPaceSecPerKm(0);
    setCurrentSpeedKmh(0);
    setSplits([]);
    statusRef.current = 'running';
    setStatus('running');

    if (workoutModeRef.current === 'intervals') {
      audioCoachRef.current.announceIntervalSwitch('fast');
    } else {
      audioCoachRef.current.announceStart();
    }
  }, [accuracyMeters]);

  // Iniciar cuenta regresiva 3-2-1-¡YA! sincronizada con voz
  const startRun = useCallback(() => {
    if (permissionState === 'denied') {
      setShowPermissionModal(true);
      return;
    }

    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
    }

    let step = 3;
    setCountdownValue(3);
    audioCoachRef.current.announceCountdown(3);

    countdownTimerRef.current = window.setInterval(() => {
      step -= 1;
      if (step >= 1) {
        setCountdownValue(step);
        audioCoachRef.current.announceCountdown(step);
      } else if (step === 0) {
        setCountdownValue(0);
      } else {
        executeStartRunNow();
      }
    }, 900);
  }, [permissionState, executeStartRunNow]);

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  const pauseRun = useCallback(() => {
    if (statusRef.current === 'running') {
      const now = Date.now();
      if (!isAutoPausedRef.current) {
        pauseStartedAtRef.current = now;
      }
      isAutoPausedRef.current = false;
      setIsAutoPaused(false);
      statusRef.current = 'paused';
      setStatus('paused');
      setCurrentSpeedKmh(0);
      audioCoachRef.current.announcePause();
    }
  }, []);

  const resumeRun = useCallback(() => {
    if (statusRef.current === 'paused') {
      const now = Date.now();
      if (pauseStartedAtRef.current !== null) {
        accumulatedPausedMsRef.current += Math.max(
          0,
          now - pauseStartedAtRef.current
        );
        pauseStartedAtRef.current = null;
      }
      lastMovementTimeRef.current = now;
      isAutoPausedRef.current = false;
      setIsAutoPaused(false);
      if (pathRef.current.length > 0) {
        const lastIdx = pathRef.current.length - 1;
        pathRef.current[lastIdx] = {
          ...pathRef.current[lastIdx],
          timestamp: now,
        };
      }
      statusRef.current = 'running';
      setStatus('running');
      audioCoachRef.current.announceResume();
    }
  }, []);

  const finishRun = useCallback(() => {
    const now = Date.now();
    const finalDist = distanceRef.current;
    const finalDur = Math.max(
      durationSeconds,
      computeEffectiveDurationSec(now),
      1
    );
    const avgPace = finalDist > 0.01 ? Math.round(finalDur / finalDist) : 0;

    isAutoPausedRef.current = false;
    setIsAutoPaused(false);
    startTimestampRef.current = null;
    pauseStartedAtRef.current = null;
    accumulatedPausedMsRef.current = 0;
    // Restaurar Pin Lock en idle si había casa calibrada
    pinLockRef.current = calibratedHomeRef.current !== null;

    audioCoachRef.current.announceFinish(finalDist, unitRef.current);

    const hour = new Date().getHours();
    const baseLabel =
      workoutModeRef.current === 'intervals'
        ? 'Fartlek Intervalos'
        : workoutModeRef.current === 'goal'
        ? `Objetivo ${goalDistanceKmRef.current}K`
        : hour < 12
        ? 'Carrera Matutina'
        : hour < 19
        ? 'Rodaje de Tarde'
        : 'Sesión Nocturna';

    const completedActivity: RunActivity = {
      id: `run-${now}`,
      title: baseLabel,
      dateIso: new Date().toISOString(),
      durationSeconds: finalDur,
      distanceKm: Number(finalDist.toFixed(2)),
      avgPaceSecondsPerKm: avgPace,
      calories: Math.max(
        5,
        calculateMetabolicCalories(finalDist, weightKgRef.current)
      ),
      path:
        pathRef.current.length > 1
          ? [...pathRef.current]
          : [
              {
                lat: currentPosRef.current[0],
                lng: currentPosRef.current[1],
                timestamp: now,
                accuracy: 5,
                speed: 0,
                cumulativeDistanceKm: 0,
              },
            ],
      splits: computeSplitsFromPath(pathRef.current),
      isSimulated: false,
      badge:
        workoutModeRef.current === 'goal' &&
        finalDist >= goalDistanceKmRef.current
          ? `Meta ${goalDistanceKmRef.current}K Lograda`
          : finalDist >= 5
          ? '5K Completados'
          : undefined,
    };

    statusRef.current = 'idle';
    setStatus('idle');
    onRunCompleted(completedActivity);
  }, [durationSeconds, onRunCompleted, computeEffectiveDurationSec]);

  // Datos derivados de Intervalos (1' Rápido / 1' Suave)
  const currentMinuteIndex = Math.floor(durationSeconds / 60);
  const intervalPhase: IntervalPhase =
    currentMinuteIndex % 2 === 0 ? 'fast' : 'recovery';
  const intervalSecondsLeft = 60 - (durationSeconds % 60);

  return {
    status,
    countdownValue,
    skipCountdown: executeStartRunNow,
    isAutoPaused,
    workoutMode,
    setWorkoutMode,
    goalDistanceKm,
    setGoalDistanceKm,
    intervalPhase,
    intervalSecondsLeft,
    currentPosition,
    accuracyMeters,
    signalQuality,
    isCalibrated,
    calibratePosition,
    resetCalibration,
    durationSeconds,
    distanceKm,
    currentPaceSecPerKm,
    currentSpeedKmh,
    path,
    splits,
    isWakeLockActive,
    permissionState,
    showPermissionModal,
    permissionErrorMsg,
    setShowPermissionModal,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
  };
}

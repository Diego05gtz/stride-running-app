import { useCallback, useMemo, useRef } from 'react';
import { IntervalPhase, UnitSystem } from '../types/run';

const KM_TO_MILES = 0.621371;

export function useAudioCoach(enabled: boolean) {
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const speak = useCallback((text: string) => {
    if (!enabledRef.current) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);

      // Seleccionar voz en español (priorizando es-MX o es-ES)
      const voices = window.speechSynthesis.getVoices();
      const spanishVoice =
        voices.find((v) => v.lang.toLowerCase().startsWith('es-mx')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('es-es')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('es'));

      if (spanishVoice) {
        utterance.voice = spanishVoice;
        utterance.lang = spanishVoice.lang;
      } else {
        utterance.lang = 'es-MX';
      }

      utterance.rate = 1.04;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignorar errores si el navegador bloquea la síntesis de voz
    }
  }, []);

  const announceCountdown = useCallback(
    (num: number) => {
      speak(String(num));
    },
    [speak]
  );

  const announceStart = useCallback(() => {
    speak('¡Ya! Entrenamiento iniciado. ¡Buen ritmo!');
  }, [speak]);

  const announcePause = useCallback(() => {
    speak('Entrenamiento en pausa.');
  }, [speak]);

  const announceResume = useCallback(() => {
    speak('Reanudando entrenamiento.');
  }, [speak]);

  const announceAutoPause = useCallback(() => {
    speak('Auto pausa activada. En espera de movimiento.');
  }, [speak]);

  const announceAutoResume = useCallback(() => {
    speak('Movimiento detectado. Reanudando carrera.');
  }, [speak]);

  const announceFinish = useCallback(
    (distanceKm: number, unit: UnitSystem) => {
      const converted =
        unit === 'mi' ? distanceKm * KM_TO_MILES : distanceKm;
      const distFormatted = converted.toFixed(2).replace('.', ' punto ');
      const unitLabel = unit === 'mi' ? 'millas' : 'kilómetros';
      speak(
        `Entrenamiento finalizado. Distancia total: ${distFormatted} ${unitLabel}.`
      );
    },
    [speak]
  );

  const announceSplit = useCallback(
    (splitNumber: number, paceSecondsPerKm: number, unit: UnitSystem) => {
      const adjustedPace =
        unit === 'mi' ? paceSecondsPerKm / KM_TO_MILES : paceSecondsPerKm;
      const totalSeconds = Math.max(0, Math.round(adjustedPace));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      const unitNoun =
        unit === 'mi'
          ? `Milla ${splitNumber} completada`
          : `Kilómetro ${splitNumber} completado`;

      speak(
        `${unitNoun}. Ritmo actual: ${minutes} minutos con ${seconds} segundos.`
      );
    },
    [speak]
  );

  const announceGoalHalfway = useCallback(
    (goalKm: number) => {
      speak(
        `¡Mitad de tu meta de ${goalKm} kilómetros alcanzada! Mantén el paso.`
      );
    },
    [speak]
  );

  const announceGoalLast500m = useCallback(() => {
    speak('¡Atención! Últimos quinientos metros para alcanzar tu meta.');
  }, [speak]);

  const announceGoalCompleted = useCallback(
    (goalKm: number) => {
      speak(`¡Meta de ${goalKm} kilómetros completada! Excelente trabajo.`);
    },
    [speak]
  );

  const announceIntervalSwitch = useCallback(
    (phase: IntervalPhase) => {
      if (phase === 'fast') {
        speak('¡Cambio a ritmo rápido! Un minuto fuerte.');
      } else {
        speak('¡Recuperación suave! Un minuto para respirar.');
      }
    },
    [speak]
  );

  // Memorizar objeto retornado para evitar re-ejecución infinita de efectos consumidores
  return useMemo(
    () => ({
      speak,
      announceCountdown,
      announceStart,
      announcePause,
      announceResume,
      announceAutoPause,
      announceAutoResume,
      announceFinish,
      announceSplit,
      announceGoalHalfway,
      announceGoalLast500m,
      announceGoalCompleted,
      announceIntervalSwitch,
    }),
    [
      speak,
      announceCountdown,
      announceStart,
      announcePause,
      announceResume,
      announceAutoPause,
      announceAutoResume,
      announceFinish,
      announceSplit,
      announceGoalHalfway,
      announceGoalLast500m,
      announceGoalCompleted,
      announceIntervalSwitch,
    ]
  );
}

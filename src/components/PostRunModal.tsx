import React, { useState } from 'react';
import {
  Award,
  Check,
  Share2,
  X,
  Flame,
  Calendar,
  Download,
  Image as ImageIcon,
} from 'lucide-react';
import {
  AccentTheme,
  RunActivity,
  RunFeeling,
  UnitSystem,
} from '../types/run';
import {
  formatDistance,
  formatDuration,
  formatPace,
} from '../utils/geoMath';
import { exportActivityToGpx } from '../utils/gpxExport';
import { exportRunPosterPng } from '../utils/posterExport';
import { ACCENT_PALETTES } from '../utils/theme';
import { LiveMap } from './LiveMap';

interface PostRunModalProps {
  activity: RunActivity | null;
  unit: UnitSystem;
  accent: AccentTheme;
  onUpdateRun?: (id: string, partial: Partial<RunActivity>) => void;
  onClose: () => void;
}

const FEELING_OPTIONS: RunFeeling[] = ['🔥 Fuerte', '⚡ Rápida', '🌿 Ligera'];

export const PostRunModal: React.FC<PostRunModalProps> = ({
  activity,
  unit,
  accent,
  onUpdateRun,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!activity) return null;

  const palette = ACCENT_PALETTES[accent];
  const lastCoord: [number, number] =
    activity.path.length > 0
      ? [
          activity.path[activity.path.length - 1].lat,
          activity.path[activity.path.length - 1].lng,
        ]
      : [19.4204, -99.1819];

  const formattedDate = new Date(activity.dateIso).toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calcular límites de ritmo para escalar las barras de splits sin ejes saturados
  const paces = activity.splits.map((s) => s.paceSecondsPerKm);
  const fastestPace = paces.length > 0 ? Math.min(...paces) : 0;
  const slowestPace = paces.length > 0 ? Math.max(...paces) : 1;

  const handleSharePoster = async () => {
    const shareText = `🏃‍♂️ STRIDE — ${activity.title}\n📍 Distancia: ${formatDistance(
      activity.distanceKm,
      unit
    )} ${unit}\n⚡ Ritmo: ${formatPace(
      activity.avgPaceSecondsPerKm,
      unit
    )} /${unit}\n⏱️ Tiempo: ${formatDuration(activity.durationSeconds)}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `STRIDE — ${activity.title}`,
          text: shareText,
        });
        return;
      } catch {
        // Fallback a portapapeles
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
      {/* PÓSTER COMPARTIBLE */}
      <div className="relative w-full max-w-md rounded-[32px] bg-[#10121A] border border-white/10 overflow-hidden shadow-[0_25px_70px_rgba(0,0,0,0.9)] my-auto">
        {/* Cabecera sobre el mapa con Polilínea Dinámica por Ritmo y Pines 1K, 2K... */}
        <div className="relative h-64 w-full bg-[#090A0F]">
          <LiveMap
            currentPosition={lastCoord}
            path={activity.path}
            accent={accent}
            fitBoundsMode={true}
            paceHeatmap={true}
            interactive={false}
          />

          <div className="absolute top-4 inset-x-4 z-20 flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-[#090A0F]/80 backdrop-blur-md border border-white/10 px-3 py-1">
              <span className={`w-2 h-2 rounded-full ${palette.bgClass}`} />
              <span className="font-display text-xs font-bold tracking-widest uppercase text-white">
                STRIDE
              </span>
            </div>

            <button
              onClick={onClose}
              className="rounded-full bg-[#090A0F]/80 backdrop-blur-md border border-white/10 p-2 text-zinc-300 hover:text-white transition"
              aria-label="Cerrar resumen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Leyenda minimalista de ritmo sobre el mapa */}
          <div className="absolute bottom-3 inset-x-4 z-20 flex items-center justify-between">
            {activity.badge ? (
              <div className="flex items-center gap-1.5 rounded-full bg-[#090A0F]/90 border border-white/15 px-3 py-1 text-xs font-semibold text-white shadow-md">
                <Award className={`w-3.5 h-3.5 ${palette.textClass}`} />
                <span>{activity.badge}</span>
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2 rounded-full bg-[#090A0F]/85 backdrop-blur-md border border-white/10 px-2.5 py-1 text-[10px] text-zinc-300">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#00D9F5]" /> Suave
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#00F5A0]" /> Medio
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#FF5E3A]" /> Sprint
              </span>
            </div>
          </div>
        </div>

        {/* Cuerpo del Póster */}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold text-white tracking-tight">
                {activity.title}
              </h2>
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-0.5 capitalize">
                <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                <span>{formattedDate}</span>
              </p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium text-zinc-400 bg-white/5 rounded-full px-3 py-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="tabular-nums">{activity.calories} kcal</span>
            </div>
          </div>

          {/* Selector rápido de sensación de la sesión */}
          {onUpdateRun && (
            <div className="mt-4 flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 mr-1">
                Sensación:
              </span>
              {FEELING_OPTIONS.map((feel) => {
                const isSelected = activity.feeling === feel;
                return (
                  <button
                    key={feel}
                    onClick={() =>
                      onUpdateRun(activity.id, {
                        feeling: isSelected ? undefined : feel,
                      })
                    }
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                      isSelected
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-white/[0.03] border-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {feel}
                  </button>
                );
              })}
            </div>
          )}

          {/* 3 MÉTRICAS LIMPIAS DE ALTO CONTRASTE */}
          <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-[#090A0F] border border-white/5 p-4">
            <div>
              <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 block">
                Distancia
              </span>
              <span className="font-display text-2xl font-extrabold text-white tabular-nums mt-0.5 block">
                {formatDistance(activity.distanceKm, unit)}
                <small className="text-xs font-normal text-zinc-400 ml-1">
                  {unit}
                </small>
              </span>
            </div>

            <div className="border-x border-white/5 px-3">
              <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 block">
                Ritmo Med.
              </span>
              <span
                className={`font-display text-2xl font-extrabold tabular-nums mt-0.5 block ${palette.textClass}`}
              >
                {formatPace(activity.avgPaceSecondsPerKm, unit)}
              </span>
            </div>

            <div className="pl-1">
              <span className="text-[10px] uppercase tracking-[0.15em] text-zinc-500 block">
                Tiempo
              </span>
              <span className="font-display text-2xl font-extrabold text-white tabular-nums mt-0.5 block">
                {formatDuration(activity.durationSeconds)}
              </span>
            </div>
          </div>

          {/* GRÁFICO MINIMALISTA DE RITMO POR KILÓMETRO (Splits sin ejes saturados) */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-400">
                Parciales por Kilómetro
              </span>
              <span className="text-[11px] text-zinc-500">min/{unit}</span>
            </div>

            {activity.splits.length === 0 ? (
              <div className="rounded-2xl bg-white/[0.02] border border-white/5 py-3.5 px-3 text-center text-xs text-zinc-500">
                Completa al menos 1 km para desglosar parciales por kilómetro.
              </div>
            ) : (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {activity.splits.map((split) => {
                  const isFastest = split.paceSecondsPerKm === fastestPace;
                  const range = Math.max(slowestPace - fastestPace, 15);
                  const normalizedWidth =
                    100 -
                    ((split.paceSecondsPerKm - fastestPace) / range) * 32;

                  return (
                    <div
                      key={split.kmIndex}
                      className="flex items-center gap-3 text-xs"
                    >
                      <span className="w-6 text-zinc-500 font-semibold tabular-nums">
                        {split.kmIndex}K
                      </span>
                      <div className="flex-1 h-6 rounded-lg bg-white/[0.03] overflow-hidden flex items-center p-0.5">
                        <div
                          style={{ width: `${Math.max(45, normalizedWidth)}%` }}
                          className={`h-full rounded-md transition-all duration-500 flex items-center justify-end pr-2.5 ${
                            isFastest
                              ? `${palette.bgClass} text-[#090A0F] font-bold`
                              : 'bg-white/15 text-zinc-200 font-medium'
                          }`}
                        >
                          <span className="tabular-nums text-[11px]">
                            {formatPace(split.paceSecondsPerKm, unit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Botones de Acción: Compartir Póster PNG (1080x1920) + Exportar GPX + Texto */}
          <div className="mt-6 flex flex-col gap-2.5">
            <button
              onClick={() => exportRunPosterPng(activity, unit, accent)}
              style={{ boxShadow: palette.shadowStyle }}
              className={`w-full py-3.5 px-4 rounded-2xl ${palette.bgClass} text-[#090A0F] font-display font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition`}
              title="Descargar imagen PNG 1080x1920 lista para Instagram Story"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Compartir Póster PNG</span>
            </button>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => exportActivityToGpx(activity)}
                className="flex-1 py-3 px-3 rounded-2xl bg-white/[0.07] hover:bg-white/15 border border-white/10 text-white font-display font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
                title="Descargar archivo GPX para Strava o Garmin"
              >
                <Download className={`w-4 h-4 ${palette.textClass}`} />
                <span>Exportar GPX</span>
              </button>

              <button
                onClick={handleSharePoster}
                className="flex-1 py-3 px-3 rounded-2xl bg-white/[0.07] hover:bg-white/15 border border-white/10 text-white font-display font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition"
              >
                {copied ? (
                  <>
                    <Check className={`w-4 h-4 ${palette.textClass}`} />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-zinc-300" />
                    <span>Copiar Resumen</span>
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white font-medium text-xs sm:text-sm transition"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

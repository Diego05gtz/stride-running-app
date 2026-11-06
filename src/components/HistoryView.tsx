import React, { useMemo, useRef, useState } from 'react';
import {
  Award,
  ChevronRight,
  Trash2,
  Footprints,
  Download,
  Upload,
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
import { parseGpxFileToActivity } from '../utils/gpxImport';
import { ACCENT_PALETTES } from '../utils/theme';
import { MiniRouteSvg } from './MiniRouteSvg';

type HistoryFilter = 'all' | '5k' | 'pr';

const FEELINGS_CYCLE: RunFeeling[] = ['🔥 Fuerte', '⚡ Rápida', '🌿 Ligera'];

interface HistoryViewProps {
  runs: RunActivity[];
  unit: UnitSystem;
  weightKg: number;
  accent: AccentTheme;
  onSelectRun: (run: RunActivity) => void;
  onImportRun: (run: RunActivity) => void;
  onUpdateRun: (id: string, partial: Partial<RunActivity>) => void;
  onDeleteRun: (id: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  runs,
  unit,
  weightKg,
  accent,
  onSelectRun,
  onImportRun,
  onUpdateRun,
  onDeleteRun,
}) => {
  const palette = ACCENT_PALETTES[accent];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const totalDistanceKm = runs.reduce((acc, r) => acc + r.distanceKm, 0);

  const filteredRuns = useMemo(() => {
    if (filter === '5k') {
      return runs.filter((r) => r.distanceKm >= 5);
    }
    if (filter === 'pr') {
      return runs.filter((r) => Boolean(r.badge));
    }
    return runs;
  }, [runs, filter]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      setImportError(null);
      const importedActivity = await parseGpxFileToActivity(file, weightKg);
      onImportRun(importedActivity);
    } catch (err) {
      setImportError(
        err instanceof Error
          ? err.message
          : 'No se pudo leer el archivo GPX seleccionado.'
      );
    }
  };

  const handleCycleFeeling = (
    e: React.MouseEvent,
    run: RunActivity
  ) => {
    e.stopPropagation();
    const currentIdx = run.feeling
      ? FEELINGS_CYCLE.indexOf(run.feeling)
      : -1;
    const nextFeeling =
      currentIdx === -1
        ? FEELINGS_CYCLE[0]
        : currentIdx + 1 < FEELINGS_CYCLE.length
        ? FEELINGS_CYCLE[currentIdx + 1]
        : undefined;
    onUpdateRun(run.id, { feeling: nextFeeling });
  };

  return (
    <div className="w-full h-[100dvh] min-h-[100dvh] overflow-y-auto px-5 pt-8 pb-28 max-w-lg mx-auto">
      {/* CABECERA: Protagonista Visual + Botón Importar GPX */}
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 block">
            Historial de Entrenamiento
          </span>
          <div className="mt-1.5 flex items-baseline gap-2.5">
            <span className="font-display text-5xl sm:text-6xl font-extrabold text-white tabular-nums tracking-tight">
              {formatDistance(totalDistanceKm, unit)}
            </span>
            <span
              className={`font-display text-lg sm:text-xl font-bold uppercase ${palette.textClass}`}
            >
              {unit} totales
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            {runs.length}{' '}
            {runs.length === 1 ? 'sesión guardada' : 'sesiones guardadas'}
          </p>
        </div>

        {/* Input oculto y botón minimalista "📥 Importar GPX" */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gpx,application/gpx+xml,text/xml"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-2xl bg-[#10121A] hover:bg-[#161924] border border-white/10 px-3.5 py-2.5 text-xs font-semibold text-white shadow-md active:scale-95 transition"
            title="Importar archivo .gpx desde tu dispositivo"
          >
            <Upload className={`w-3.5 h-3.5 ${palette.textClass}`} />
            <span>📥 Importar GPX</span>
          </button>
        </div>
      </header>

      {importError && (
        <div className="mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-xs text-rose-300">
          {importError}
        </div>
      )}

      {/* PÍLDORAS DE FILTRO LIMPIAS: Todas, 5K+, Récords PR */}
      <div className="mb-5 flex items-center gap-2">
        {(
          [
            { id: 'all', label: `Todas (${runs.length})` },
            {
              id: '5k',
              label: `5K+ (${runs.filter((r) => r.distanceKm >= 5).length})`,
            },
            {
              id: 'pr',
              label: `Récords PR (${runs.filter((r) => Boolean(r.badge)).length})`,
            },
          ] as { id: HistoryFilter; label: string }[]
        ).map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
                active
                  ? `${palette.bgClass} text-[#090A0F]`
                  : 'bg-[#10121A] border border-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* FEED DE TARJETAS LIMPIAS */}
      {filteredRuns.length === 0 ? (
        <div className="rounded-3xl bg-[#10121A] border border-white/5 p-10 text-center">
          <Footprints className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="font-display text-base font-semibold text-white">
            No hay carreras en este filtro
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            Inicia una sesión en vivo o importa un archivo GPX para visualizar su ruta.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filteredRuns.map((run) => {
            const dateStr = new Date(run.dateIso).toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'short',
            });
            const isConfirmingDelete = confirmDeleteId === run.id;

            return (
              <div
                key={run.id}
                onClick={() => onSelectRun(run)}
                className="group relative flex items-center gap-4 rounded-3xl bg-[#10121A] hover:bg-[#161924] border border-white/[0.07] p-4 transition cursor-pointer active:scale-[0.99]"
              >
                {/* Miniatura vectorial de la polilínea GPS */}
                <MiniRouteSvg
                  path={run.path}
                  accent={accent}
                  className="w-20 h-20 shrink-0"
                />

                {/* Información limpia */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-medium text-zinc-400 capitalize">
                      {dateStr}
                    </span>
                    {run.badge && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] border border-white/10 px-2 py-0.5 text-[10px] font-semibold text-white">
                        <Award className={`w-3 h-3 ${palette.textClass}`} />
                        {run.badge}
                      </span>
                    )}
                    <button
                      onClick={(e) => handleCycleFeeling(e, run)}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border transition ${
                        run.feeling
                          ? 'bg-white/[0.06] border-white/15 text-zinc-200'
                          : 'bg-transparent border-white/5 text-zinc-500 hover:text-zinc-300'
                      }`}
                      title="Clic para cambiar sensación (🔥 Fuerte / ⚡ Rápida / 🌿 Ligera)"
                    >
                      {run.feeling || '+ Sensación'}
                    </button>
                  </div>

                  <h3 className="font-display text-base font-bold text-white truncate mt-0.5">
                    {run.title}
                  </h3>

                  {/* 3 métricas clave tabulares */}
                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <div>
                      <span className="font-display font-bold text-base text-white tabular-nums">
                        {formatDistance(run.distanceKm, unit)}
                      </span>{' '}
                      <span className="text-zinc-500">{unit}</span>
                    </div>

                    <div className="border-l border-white/10 pl-3">
                      <span
                        className={`font-display font-bold text-base tabular-nums ${palette.textClass}`}
                      >
                        {formatPace(run.avgPaceSecondsPerKm, unit)}
                      </span>{' '}
                      <span className="text-zinc-500">/{unit}</span>
                    </div>

                    <div className="border-l border-white/10 pl-3 text-zinc-300 tabular-nums font-medium">
                      {formatDuration(run.durationSeconds)}
                    </div>
                  </div>
                </div>

                {/* Acciones discretas: Exportar GPX + Eliminar con confirmación sutil */}
                <div className="flex flex-col items-end justify-between self-stretch py-0.5 gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        exportActivityToGpx(run);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.05] hover:bg-white/10 border border-white/10 text-[10px] font-semibold text-zinc-300 hover:text-white transition"
                      title="Exportar ruta en formato GPX (Strava / Garmin)"
                    >
                      <Download className={`w-3 h-3 ${palette.textClass}`} />
                      <span>GPX</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isConfirmingDelete) {
                          onDeleteRun(run.id);
                          setConfirmDeleteId(null);
                        } else {
                          setConfirmDeleteId(run.id);
                          setTimeout(() => {
                            setConfirmDeleteId((prev) =>
                              prev === run.id ? null : prev
                            );
                          }, 3000);
                        }
                      }}
                      className={`px-2 py-1 rounded-full text-[10px] font-semibold transition flex items-center gap-1 ${
                        isConfirmingDelete
                          ? 'bg-rose-500 text-white'
                          : 'text-zinc-500 hover:text-rose-400 hover:bg-white/5'
                      }`}
                      title="Eliminar carrera"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isConfirmingDelete && <span>¿Borrar?</span>}
                    </button>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

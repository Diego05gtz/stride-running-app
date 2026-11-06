import React, { useState, useCallback } from 'react';
import { Activity, History, Target } from 'lucide-react';
import { RunActivity, UserPreferences } from './types/run';
import {
  deleteSavedRun,
  loadSavedRuns,
  loadUserPreferences,
  saveNewRun,
  saveUserPreferences,
  updateSavedRun,
} from './utils/storage';
import { useGeoTracker } from './hooks/useGeoTracker';
import { ACCENT_PALETTES } from './utils/theme';
import { LiveRunView } from './components/LiveRunView';
import { HistoryView } from './components/HistoryView';
import { ProfileGoalsView } from './components/ProfileGoalsView';
import { PostRunModal } from './components/PostRunModal';
import { PermissionModal } from './components/PermissionModal';

type NavTab = 'live' | 'history' | 'goals';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('live');
  const [runs, setRuns] = useState<RunActivity[]>(() => loadSavedRuns());
  const [prefs, setPrefs] = useState<UserPreferences>(() =>
    loadUserPreferences()
  );
  const [selectedActivityPoster, setSelectedActivityPoster] =
    useState<RunActivity | null>(null);

  const handleUpdatePrefs = useCallback((partial: Partial<UserPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      saveUserPreferences(next);
      return next;
    });
  }, []);

  const handleRunCompleted = useCallback((activity: RunActivity) => {
    const updated = saveNewRun(activity);
    setRuns(updated);
    setSelectedActivityPoster(activity);
  }, []);

  const handleUpdateRun = useCallback(
    (id: string, partial: Partial<RunActivity>) => {
      const updated = updateSavedRun(id, partial);
      setRuns(updated);
      setSelectedActivityPoster((prev) =>
        prev && prev.id === id ? { ...prev, ...partial } : prev
      );
    },
    []
  );

  const handleDeleteRun = useCallback((id: string) => {
    const updated = deleteSavedRun(id);
    setRuns(updated);
  }, []);

  const handleRestoreBackup = useCallback(
    (data: { runs: RunActivity[]; prefs: UserPreferences }) => {
      setRuns(data.runs);
      setPrefs(data.prefs);
    },
    []
  );

  const handleToggleSimulation = useCallback(
    (enabled: boolean) => {
      handleUpdatePrefs({ simulationMode: enabled });
    },
    [handleUpdatePrefs]
  );

  const handleToggleVoiceCoach = useCallback(
    (enabled: boolean) => {
      handleUpdatePrefs({ voiceCoachEnabled: enabled });
    },
    [handleUpdatePrefs]
  );

  const handleToggleAutoPause = useCallback(
    (enabled: boolean) => {
      handleUpdatePrefs({ autoPauseEnabled: enabled });
    },
    [handleUpdatePrefs]
  );

  const tracker = useGeoTracker({
    simulationMode: prefs.simulationMode,
    voiceCoachEnabled: prefs.voiceCoachEnabled,
    autoPauseEnabled: prefs.autoPauseEnabled,
    weightKg: prefs.weightKg || 70,
    unit: prefs.unit,
    onToggleSimulation: handleToggleSimulation,
    onRunCompleted: handleRunCompleted,
  });

  const palette = ACCENT_PALETTES[prefs.accent];

  return (
    <div className="relative w-full h-full flex flex-col bg-[#090A0F] text-white overflow-hidden select-none">
      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {activeTab === 'live' && (
          <LiveRunView
            status={tracker.status}
            countdownValue={tracker.countdownValue}
            isAutoPaused={tracker.isAutoPaused}
            workoutMode={tracker.workoutMode}
            goalDistanceKm={tracker.goalDistanceKm}
            intervalPhase={tracker.intervalPhase}
            intervalSecondsLeft={tracker.intervalSecondsLeft}
            currentPosition={tracker.currentPosition}
            accuracyMeters={tracker.accuracyMeters}
            signalQuality={tracker.signalQuality}
            isCalibrated={tracker.isCalibrated}
            durationSeconds={tracker.durationSeconds}
            distanceKm={tracker.distanceKm}
            currentPaceSecPerKm={tracker.currentPaceSecPerKm}
            currentSpeedKmh={tracker.currentSpeedKmh}
            path={tracker.path}
            splits={tracker.splits}
            isWakeLockActive={tracker.isWakeLockActive}
            simulationMode={prefs.simulationMode}
            voiceCoachEnabled={prefs.voiceCoachEnabled}
            autoPauseEnabled={prefs.autoPauseEnabled}
            weightKg={prefs.weightKg || 70}
            unit={prefs.unit}
            accent={prefs.accent}
            onSkipCountdown={tracker.skipCountdown}
            onSelectWorkoutMode={tracker.setWorkoutMode}
            onSelectGoalDistance={tracker.setGoalDistanceKm}
            onCalibratePosition={tracker.calibratePosition}
            onResetCalibration={tracker.resetCalibration}
            onToggleSimulation={handleToggleSimulation}
            onToggleVoiceCoach={handleToggleVoiceCoach}
            onToggleAutoPause={handleToggleAutoPause}
            onStart={tracker.startRun}
            onPause={tracker.pauseRun}
            onResume={tracker.resumeRun}
            onFinish={tracker.finishRun}
          />
        )}

        {activeTab === 'history' && (
          <HistoryView
            runs={runs}
            unit={prefs.unit}
            weightKg={prefs.weightKg || 70}
            accent={prefs.accent}
            onSelectRun={(run) => setSelectedActivityPoster(run)}
            onImportRun={handleRunCompleted}
            onUpdateRun={handleUpdateRun}
            onDeleteRun={handleDeleteRun}
          />
        )}

        {activeTab === 'goals' && (
          <ProfileGoalsView
            runs={runs}
            prefs={prefs}
            onUpdatePrefs={handleUpdatePrefs}
            onRestoreBackup={handleRestoreBackup}
          />
        )}
      </main>

      {/* BOTTOM NAVIGATION ESTILO APP MÓVIL DEPORTIVA */}
      <nav className="fixed bottom-0 inset-x-0 z-30 pointer-events-none flex justify-center px-4 pb-3">
        <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-[#10121A]/90 backdrop-blur-2xl border border-white/10 px-3 py-1.5 flex items-center justify-around shadow-2xl">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-5 rounded-xl transition ${
              activeTab === 'live'
                ? palette.textClass
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="relative">
              <Activity className="w-5 h-5" />
              {tracker.status === 'running' && (
                <span
                  className={`absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full ${palette.bgClass} animate-ping`}
                />
              )}
            </div>
            <span className="text-[10px] font-semibold tracking-wide">
              En Vivo
            </span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-5 rounded-xl transition ${
              activeTab === 'history'
                ? palette.textClass
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-wide">
              Progreso
            </span>
          </button>

          <button
            onClick={() => setActiveTab('goals')}
            className={`flex flex-col items-center gap-0.5 py-1.5 px-5 rounded-xl transition ${
              activeTab === 'goals'
                ? palette.textClass
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Target className="w-5 h-5" />
            <span className="text-[10px] font-semibold tracking-wide">
              Objetivos
            </span>
          </button>
        </div>
      </nav>

      {/* MODAL PÓSTER COMPARTIBLE (POST-CARRERA O DETALLE DE HISTORIAL) */}
      <PostRunModal
        activity={selectedActivityPoster}
        unit={prefs.unit}
        accent={prefs.accent}
        onUpdateRun={handleUpdateRun}
        onClose={() => setSelectedActivityPoster(null)}
      />

      {/* MODAL MINIMALISTA DE PERMISOS GPS */}
      <PermissionModal
        isOpen={tracker.showPermissionModal}
        message={tracker.permissionErrorMsg}
        accent={prefs.accent}
        onClose={() => tracker.setShowPermissionModal(false)}
        onEnableSimulator={tracker.switchToSimulatorFromModal}
      />
    </div>
  );
};

export default App;

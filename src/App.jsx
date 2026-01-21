import { getTodayString } from "./utils/DateUtils";
import { VIEWS } from "./utils/Constants";
import PracticeGame from "./utils/PracticeGame";
import HardModeGame from "./utils/HardModeGame";
import RegionSelector from "./components/RegionSelector";
import ModeSelector from "./components/ModeSelector";
import StatsView from "./components/StatsView";
import SettingsView from "./components/SettingsView";
import GameView from "./components/GameView";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useGameData } from "./hooks/useGameData";
import { useDailyGame } from "./hooks/useDailyGame";
import { usePersistence } from "./hooks/usePersistence";
import { useGameNavigation } from "./hooks/useGameNavigation";
import { useGameInitialization } from "./hooks/useGameInitialization";
import { useShareResult } from "./hooks/useShareResult";
import { useMigration } from "./hooks/useMigration";
import { useNormalGameStore } from "./stores/normalGameStore";
import { useHardModeStore } from "./stores/hardModeStore";

export default function AudioBirdle() {
  const { selectedRegion, setSelectedRegion, lastPlayedMode, setLastPlayedMode } = usePersistence();

  const audioPlayer = useAudioPlayer();
  const { selectedAudioIndex, setSelectedAudioIndex } = audioPlayer;

  const {
    regions,
    birds,
    todaysBird,
    dataConsistencyError,
    hasUpdate,
    refreshingData,
    handleForceRefresh,
    handleRefreshData,
  } = useGameData(selectedRegion);

  const today = getTodayString();

  const {
    makeGuess,
    resetTodaysGame,
    resetAllData,
    answerOptions,
  } = useDailyGame(selectedRegion, today, birds, todaysBird);

  const currentDailyGame = useNormalGameStore((state) =>
    selectedRegion && today ? state.getDailyGame(`${selectedRegion}-${today}`) : null
  );

  const hardModeGame = useHardModeStore((state) =>
    selectedRegion && today ? state.getHardModeGame(`${selectedRegion}-${today}`) : null
  );

  const normalModeGame = useNormalGameStore((state) =>
    selectedRegion && today ? state.getDailyGame(`${selectedRegion}-${today}`) : null
  );

  const stats = useNormalGameStore((state) => state.stats);

  const { currentView, setCurrentView } = useGameNavigation();

  useMigration();

  useGameInitialization(selectedRegion, today, currentDailyGame);

  const { handleShareResult } = useShareResult(currentDailyGame, todaysBird, selectedRegion);

  const gameModes = [
    {
      name: "Normal Mode",
      description: "Daily challenge • 4 guesses • Multiple choice",
      icon: "🎯",
      mode: "normal",
      view: VIEWS.GAME,
      color: "blue",
    },
    {
      name: "Hard Mode",
      description:
        "Daily challenge • 6 guesses • Free text • Taxonomic hints",
      icon: "🔥",
      mode: "hard",
      view: VIEWS.HARD_MODE,
      color: "red",
    },
    {
      name: "Practice Mode",
      description: "Unlimited play • No daily limit",
      icon: "🎮",
      mode: "practice",
      view: VIEWS.PRACTICE,
      color: "purple",
    },
  ];

  if (!selectedRegion) {
    return <RegionSelector regions={regions} today={today} onRegionSelect={setSelectedRegion} />;
  }

  if (currentView === VIEWS.MODE_SELECTOR) {
    const normalCompleted = currentDailyGame?.completed === true;
    const hardCompleted = hardModeGame?.completed === true;

    return (
      <ModeSelector
        gameModes={gameModes}
        onModeSelect={(view, mode) => {
          setCurrentView(view);
          setLastPlayedMode(mode);
        }}
        lastPlayedMode={lastPlayedMode}
        selectedRegion={selectedRegion}
        regions={regions}
        normalCompleted={normalCompleted}
        hardCompleted={hardCompleted}
      />
    );
  }

  if (currentView === VIEWS.PRACTICE) {
    return (
      <PracticeGame
        region={selectedRegion}
        birds={birds}
        regions={regions}
        onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
      />
    );
  }

  if (currentView === VIEWS.HARD_MODE) {
    const normalModeCompleted = normalModeGame?.completed === true;

    return (
      <HardModeGame
        region={selectedRegion}
        birds={birds}
        todaysBird={todaysBird}
        onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
        normalModeCompleted={normalModeCompleted}
        dataConsistencyError={dataConsistencyError}
        hasUpdate={hasUpdate}
        refreshingData={refreshingData}
        handleForceRefresh={handleForceRefresh}
      />
    );
  }

  if (currentView === VIEWS.SETTINGS) {
    return (
      <SettingsView
        selectedRegion={selectedRegion}
        regions={regions}
        onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
        onChangeRegion={() => setSelectedRegion(null)}
        onViewStats={() => setCurrentView(VIEWS.STATS)}
        onResetTodaysGame={resetTodaysGame}
        onResetAllData={resetAllData}
        onRefreshData={handleRefreshData}
        refreshingData={refreshingData}
        hasUpdate={hasUpdate}
      />
    );
  }

  if (currentView === VIEWS.STATS) {
    return (
      <StatsView
        stats={stats}
        regions={regions}
        onBack={() => setCurrentView(VIEWS.SETTINGS)}
      />
    );
  }

  const hardModeCompleted = hardModeGame?.completed === true;

  return (
    <GameView
      selectedRegion={selectedRegion}
      today={today}
      regions={regions}
      todaysBird={todaysBird}
      currentDailyGame={currentDailyGame}
      answerOptions={answerOptions}
      makeGuess={makeGuess}
      audioPlayer={audioPlayer}
      selectedAudioIndex={selectedAudioIndex}
      setSelectedAudioIndex={setSelectedAudioIndex}
      dataConsistencyError={dataConsistencyError}
      hasUpdate={hasUpdate}
      refreshingData={refreshingData}
      handleForceRefresh={handleForceRefresh}
      handleShareResult={handleShareResult}
      onBack={(destination) => {
        if (destination === "settings") {
          setCurrentView(VIEWS.SETTINGS);
        } else {
          setCurrentView(VIEWS.MODE_SELECTOR);
        }
      }}
      onModeChange={(mode) => {
        if (mode === "hard") {
          setCurrentView(VIEWS.HARD_MODE);
        } else if (mode === "practice") {
          setCurrentView(VIEWS.PRACTICE);
        }
      }}
      hardModeCompleted={hardModeCompleted}
    />
  );
}

import { useState } from "react";
import { getTodayString } from "./utils/DateUtils";
import { VIEWS } from "./utils/Constants";
import RegionSelector from "./components/RegionSelector";
import ModeSelector from "./components/ModeSelector";
import StatsView from "./components/StatsView";
import SettingsView from "./components/SettingsView";
import GameView from "./components/GameView";
import { useGameData } from "./hooks/useGameData";
import { usePersistence } from "./hooks/usePersistence";

import { useGameStore } from "./stores/gameStore";

export default function AudioBirdle() {
  const {
    selectedRegion,
    setSelectedRegion,
    lastPlayedMode,
    setLastPlayedMode,
  } = usePersistence();

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

  const normalGame = useGameStore((state) =>
    selectedRegion && today
      ? state.getDailyGame(`${selectedRegion}-${today}-normal`)
      : null,
  );

  const hardModeGame = useGameStore((state) =>
    selectedRegion && today
      ? state.getDailyGame(`${selectedRegion}-${today}-hard`)
      : null,
  );

  const stats = useGameStore((state) => state.stats);

  const [currentView, setCurrentView] = useState(VIEWS.MODE_SELECTOR);

  const gameModes = [
    {
      name: "Normal Mode",
      description: "Daily challenge \u2022 4 guesses \u2022 Multiple choice",
      icon: "\uD83C\uDFAF",
      mode: "normal",
      view: VIEWS.GAME,
      color: "blue",
    },
    {
      name: "Hard Mode",
      description:
        "Daily challenge \u2022 6 guesses \u2022 Free text \u2022 Taxonomic hints",
      icon: "\uD83D\uDD25",
      mode: "hard",
      view: VIEWS.HARD_MODE,
      color: "red",
    },
    {
      name: "Practice Mode",
      description: "Unlimited play \u2022 No daily limit",
      icon: "\uD83C\uDFAE",
      mode: "practice",
      view: VIEWS.PRACTICE,
      color: "purple",
    },
  ];

  if (!selectedRegion) {
    return (
      <RegionSelector
        regions={regions}
        today={today}
        onRegionSelect={setSelectedRegion}
      />
    );
  }

  if (currentView === VIEWS.MODE_SELECTOR) {
    const normalCompleted = normalGame?.completed === true;
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
      <GameView
        mode="normal"
        isPractice={true}
        region={selectedRegion}
        today={today}
        regions={regions}
        todaysBird={null}
        birds={birds}
        onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
      />
    );
  }

  if (currentView === VIEWS.HARD_MODE) {
    return (
      <GameView
        mode="hard"
        isPractice={false}
        region={selectedRegion}
        today={today}
        regions={regions}
        todaysBird={todaysBird}
        birds={birds}
        onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
        onNavigateSettings={() => setCurrentView(VIEWS.SETTINGS)}
        dataConsistencyError={dataConsistencyError}
        hasUpdate={hasUpdate}
        refreshingData={refreshingData}
        handleForceRefresh={handleForceRefresh}
        normalModeCompleted={normalGame?.completed === true}
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
        onResetTodaysGame={() => {
          if (!selectedRegion) return;
          const key = `${selectedRegion}-${today}-normal`;
          useGameStore.getState().setDailyGame(key, {
            region: selectedRegion,
            date: today,
            mode: "normal",
            guesses: [],
            completed: false,
            won: false,
            maxGuesses: 4,
          });
        }}
        onResetAllData={() => useGameStore.getState().reset()}
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
      mode="normal"
      isPractice={false}
      region={selectedRegion}
      today={today}
      regions={regions}
      todaysBird={todaysBird}
      birds={birds}
      onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
      onNavigateSettings={() => setCurrentView(VIEWS.SETTINGS)}
      onNavigatePractice={() => setCurrentView(VIEWS.PRACTICE)}
      onNavigateHard={() => setCurrentView(VIEWS.HARD_MODE)}
      dataConsistencyError={dataConsistencyError}
      hasUpdate={hasUpdate}
      refreshingData={refreshingData}
      handleForceRefresh={handleForceRefresh}
      hardModeCompleted={hardModeCompleted}
    />
  );
}

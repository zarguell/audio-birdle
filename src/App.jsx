import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Settings,
  Volume2,
  MapPin,
  RefreshCw,
  BarChart3,
  Target,
} from "lucide-react";

import PracticeGame from "./utils/PracticeGame";
import HardModeGame from "./utils/HardModeGame";
import BirdCompletionCard from "./utils/BirdCompletionCard";
import CountdownToMidnight from "./utils/CountdownToMidnight";
import { getTodayString, formatDateForDisplay } from "./utils/DateUtils";
import { getStoredData } from "./utils/StorageUtils";
import {
  hasPlayedRegionDate,
  hasCompletedHardMode,
  getUserPerformanceSummary,
} from "./utils/GameLogic";
import { generateShareText, shareResult } from "./utils/ShareUtils";
import { getAudioSrc, clearDeadAudioUrlsCache } from "./utils/AudioUtils";
import { STORAGE_KEYS, GAME_CONFIG, VIEWS } from "./utils/Constants";
import { SubregionDisplay } from "./utils/SubregionUtils";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useGameData } from "./hooks/useGameData";
import { useDailyGame } from "./hooks/useDailyGame";
import { useNormalGameStore } from "./stores/normalGameStore";
import { useHardModeStore } from "./stores/hardModeStore";

export default function AudioBirdle() {
  // Persistence state
  const [selectedRegion, setSelectedRegion] = useState(() =>
    getStoredData(STORAGE_KEYS.REGION, null),
  );
  const [lastPlayedMode, setLastPlayedMode] = useState(() =>
    getStoredData(STORAGE_KEYS.LAST_PLAYED_MODE, "normal"),
  );

  // Custom hooks for better separation of concerns
  const audioPlayer = useAudioPlayer();
  const {
    isPlaying,
    audioError,
    setAudioError,
    selectedAudioIndex,
    setSelectedAudioIndex,
    audioRef,
    toggleAudio,
    handleAudioError,
  } = audioPlayer;

  // Helper to reset playing state when audio ends
  const handleAudioEnded = useCallback(() => {
    // AudioPlayer doesn't export this, so we create it here
    // The audio element will naturally stop, but we need to update state
    if (audioPlayer.isPlaying) {
      // Force update through the player's methods
      audioPlayer.handleAudioError(); // This will set isPlaying to false
    }
  }, [audioPlayer]);
  const {
    regions,
    birds,
    todaysBird,
    loadingBird,
    dataConsistencyError,
    hasUpdate,
    refreshingData,
    handleAutoRefresh,
    handleForceRefresh,
    handleRefreshData,
  } = useGameData(selectedRegion);

  const today = getTodayString();

  const {
    makeGuess,
    resetTodaysGame,
    resetAllData,
    getDailyGame,
    answerOptions,
  } = useDailyGame(selectedRegion, today, birds, todaysBird);

  const currentDailyGame = getDailyGame();
  const [currentView, setCurrentView] = useState(VIEWS.MODE_SELECTOR);

  // Share functionality
  const handleShareResult = useCallback(async () => {
    if (!currentDailyGame || !todaysBird) return;

    const shareText = generateShareText(
      currentDailyGame,
      window.location.href,
      todaysBird.name,
      selectedRegion,
    );

    shareResult(shareText);
  }, [currentDailyGame, todaysBird, selectedRegion]);

  // Initialize game for today if it doesn't exist
  useEffect(() => {
    if (selectedRegion && today && !currentDailyGame) {
      const key = `${selectedRegion}-${today}`;
      const existingGame = useNormalGameStore.getState().getDailyGame(key);
      if (!existingGame) {
        useNormalGameStore.getState().setDailyGame(key, {
          region: selectedRegion,
          date: today,
          guesses: [],
          completed: false,
          won: false,
          maxGuesses: 4,
        });
      }
    }
  }, [selectedRegion, today, currentDailyGame]);

  const renderRegionSelector = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🐦 Audio-Birdle
          </h1>
          <p className="text-gray-600">Learn birds through their calls</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Select Your Region
          </h2>

          <div className="space-y-2">
            {regions.map((region) => {
              const gameState = useNormalGameStore.getState();
              const hasPlayedToday = hasPlayedRegionDate(
                gameState,
                region.id,
                today,
              );
              return (
                <button
                  key={region.id}
                  onClick={() => setSelectedRegion(region.id)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors relative"
                >
                  <div className="flex justify-between items-center">
                    <span>{region.name}</span>
                    {hasPlayedToday && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Played Today
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // Mode selector view
  const renderModeSelector = () => {
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

    const colorClasses = {
      blue: {
        border: "border-blue-200",
        hoverBg: "hover:bg-blue-50",
        hoverBorder: "hover:border-blue-400",
        title: "text-blue-800",
        badge: "bg-blue-100 text-blue-800",
      },
      red: {
        border: "border-red-200",
        hoverBg: "hover:bg-red-50",
        hoverBorder: "hover:border-red-400",
        title: "text-red-800",
        badge: "bg-red-100 text-red-800",
      },
      purple: {
        border: "border-purple-200",
        hoverBg: "hover:bg-purple-50",
        hoverBorder: "hover:border-purple-400",
        title: "text-purple-800",
        badge: "bg-purple-100 text-purple-800",
      },
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
        <div className="max-w-md mx-auto pt-16">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              🐦 Audio-Birdle
            </h1>
            <p className="text-gray-600">Learn birds through their calls</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold mb-4">Select Game Mode</h2>

            {gameModes.map((mode) => {
              const colors = colorClasses[mode.color];
              return (
                <button
                  key={mode.mode}
                  onClick={() => {
                    setCurrentView(mode.view);
                    setLastPlayedMode(mode.mode);
                  }}
                  className={`w-full text-left p-4 rounded-lg border-2 ${colors.border} ${colors.hoverBg} ${colors.hoverBorder} transition-all`}
                >
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{mode.icon}</div>
                    <div className="flex-1">
                      <div className={`font-semibold ${colors.title}`}>
                        {mode.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {mode.description}
                      </div>
                    </div>
                    {lastPlayedMode === mode.mode && (
                      <span
                        className={`text-xs ${colors.badge} px-2 py-1 rounded`}
                      >
                        Last played
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Settings Button */}
            <button
              onClick={() => setCurrentView(VIEWS.SETTINGS)}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Settings className="w-5 h-5" />
              <span>Settings</span>
            </button>
          </div>

          {/* Region Display */}
          <div className="mt-4 text-center text-sm text-gray-600">
            Current region:{" "}
            {regions.find((r) => r.id === selectedRegion)?.name ||
              "None selected"}
          </div>
        </div>
      </div>
    );
  };

  const renderStats = () => {
    const gameState = useNormalGameStore.getState();
    const stats = getUserPerformanceSummary(gameState);

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
        <div className="max-w-md mx-auto pt-8">
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setCurrentView(VIEWS.SETTINGS)}
              className="text-blue-500 hover:text-blue-600"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Your Stats</h1>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
            {/* Overall stats */}
            <div>
              <h3 className="font-semibold text-lg mb-3">
                Overall Performance
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {stats.totalGames}
                  </div>
                  <div className="text-sm text-gray-600">Games Played</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {stats.winRate}%
                  </div>
                  <div className="text-sm text-gray-600">Win Rate</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.averageGuesses}
                  </div>
                  <div className="text-sm text-gray-600">Avg Guesses</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">
                    {stats.maxStreak}
                  </div>
                  <div className="text-sm text-gray-600">Best Streak</div>
                </div>
              </div>
            </div>

            {/* Regional breakdown */}
            {stats.regionBreakdown.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3">By Region</h3>
                <div className="space-y-2">
                  {stats.regionBreakdown.map((regionStat) => {
                    const regionName =
                      regions.find((r) => r.id === regionStat.region)?.name ||
                      regionStat.region;
                    return (
                      <div
                        key={regionStat.region}
                        className="p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{regionName}</span>
                          <span className="text-sm text-gray-600">
                            {regionStat.games} games
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Win Rate: {regionStat.winRate}%</span>
                          <span>Avg: {regionStat.avgGuesses} guesses</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {stats.totalGames === 0 && (
              <div className="text-center py-8 text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No games played yet!</p>
                <p className="text-sm">Start playing to see your stats here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setCurrentView(VIEWS.MODE_SELECTOR)}
            className="text-blue-500 hover:text-blue-600"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Region
            </label>
            <div className="p-3 bg-gray-50 rounded-lg">
              {regions.find((r) => r.id === selectedRegion)?.name ||
                "None selected"}
            </div>
          </div>

          <button
            onClick={() => setSelectedRegion(null)}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Change Region
          </button>

          <button
            onClick={() => setCurrentView(VIEWS.STATS)}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            View Stats
          </button>

          <button
            onClick={resetTodaysGame}
            className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Today's Game
          </button>

          <button
            onClick={resetAllData}
            className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset All Data
          </button>

          {hasUpdate && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                🔄 New data available! Click the button below to refresh.
              </p>
            </div>
          )}

          <button
            onClick={handleRefreshData}
            disabled={refreshingData}
            className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshingData ? "animate-spin" : ""}`}
            />
            {refreshingData ? "Refreshing Data..." : "Refresh Game Data"}
          </button>
        </div>
      </div>
    </div>
  );

  const renderGame = () => {
    const gameState = useHardModeStore.getState();
    const hardModeCompleted = hasCompletedHardMode(
      gameState,
      selectedRegion,
      today,
    );

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
        <div className="max-w-md mx-auto pt-8">
          {/* Header with mode toggle */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">
                🐦 Audio-Birdle
              </h1>
              {hasUpdate && (
                <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
                  Update Available
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentView(VIEWS.HARD_MODE)}
                disabled={currentDailyGame?.completed}
                className={`${
                  currentDailyGame?.completed
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-red-600 hover:bg-red-700"
                } text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm`}
              >
                <Target className="w-4 h-4" />
                Hard Mode
              </button>
              <button
                onClick={() => setCurrentView(VIEWS.PRACTICE)}
                className="bg-purple-500 text-white px-3 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 text-sm"
              >
                <Target className="w-4 h-4" />
                Practice
              </button>
              <button
                onClick={() => setCurrentView(VIEWS.MODE_SELECTOR)}
                className="bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2 text-sm"
              >
                Change Mode
              </button>
              <button
                onClick={() => setCurrentView(VIEWS.SETTINGS)}
                className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Game content */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            {/* Warning if hard mode already completed */}
            {hardModeCompleted && (
              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800 text-center">
                  ⚠️ You've already completed Hard Mode today. You can't play
                  Normal Mode on the same day.
                </p>
              </div>
            )}

            {/* Data consistency error - prevents playing with wrong bird */}
            {dataConsistencyError && !todaysBird && (
              <div className="bg-red-50 border border-red-300 rounded-lg p-6 mb-4">
                <div className="text-center">
                  <p className="text-red-800 font-medium mb-2">
                    ⚠️ Data Sync Issue
                  </p>
                  <p className="text-sm text-red-700 mb-4">
                    {dataConsistencyError}
                  </p>
                  <div className="flex flex-col gap-2 items-center">
                    <button
                      onClick={handleForceRefresh}
                      disabled={refreshingData}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:bg-gray-400"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${refreshingData ? "animate-spin" : ""}`}
                      />
                      {refreshingData ? "Refreshing..." : "Force Refresh Data"}
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-red-600 underline text-sm hover:text-red-800"
                    >
                      Or reload the page
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center mb-6">
              <p className="text-gray-600 mb-2">
                {regions.find((r) => r.id === selectedRegion)?.name}
              </p>
              <p className="text-sm text-gray-500">
                Daily Bird Challenge • {formatDateForDisplay(today)}
              </p>
            </div>

            {/* Audio player section */}
            <div className="mb-6">
              <div className="bg-gray-50 rounded-lg p-6 text-center">
                <Volume2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />

                {/* Audio selector for multiple recordings */}
                {todaysBird &&
                  Array.isArray(todaysBird.audioUrl) &&
                  todaysBird.audioUrl.length > 1 && (
                    <div className="mb-4">
                      <select
                        value={selectedAudioIndex}
                        onChange={(e) => {
                          const newIndex = parseInt(e.target.value);
                          setSelectedAudioIndex(newIndex);
                          // Force audio reload
                          if (audioRef.current) {
                            audioRef.current.load();
                          }
                        }}
                        className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {todaysBird.audioUrl.map((_, index) => (
                          <option key={index} value={index}>
                            Recording {index + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                {todaysBird && (
                  <audio
                    ref={audioRef}
                    src={getAudioSrc(todaysBird.audioUrl, selectedAudioIndex)}
                    onEnded={handleAudioEnded}
                    onError={handleAudioError}
                    onLoadStart={() => {
                      // Reset error state when starting to load
                      setAudioError(false);
                    }}
                    preload="none"
                    key={`${todaysBird.id || "bird"}-${selectedAudioIndex}`}
                  />
                )}

                <button
                  onClick={toggleAudio}
                  disabled={!todaysBird || audioError || loadingBird}
                  className="bg-blue-500 text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto hover:bg-blue-600 transition-colors disabled:bg-gray-300"
                >
                  {loadingBird ? (
                    <>Loading...</>
                  ) : (
                    <>
                      {isPlaying ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                      {isPlaying ? "Pause" : "Play"} Bird Call
                    </>
                  )}
                </button>

                {audioError && (
                  <p className="text-red-500 text-sm mt-2">
                    Audio did not load - please try reloading the page
                  </p>
                )}
              </div>
            </div>

            {/* Previous guesses */}
            {currentDailyGame && currentDailyGame.guesses.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Your Guesses:</h3>
                <div className="space-y-2">
                  {currentDailyGame.guesses.map((guess, index) => {
                    const guessedBird = answerOptions.find(
                      (bird) => bird.id === guess.birdId,
                    );
                    return (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border-2 ${
                          guess.correct
                            ? "border-green-500 bg-green-50"
                            : "border-red-500 bg-red-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{guessedBird?.name}</span>
                          <span className="text-2xl">
                            {guess.correct ? "✅" : "❌"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Hint section */}
            <p className="text-sm text-gray-500 mt-2">
              Hint: today's selected bird was observed in the last 14 days on
              eBird in{" "}
              <SubregionDisplay selectedRegion={selectedRegion} today={today} />
              !
            </p>
            <br></br>

            {/* Answer choices */}
            {currentDailyGame &&
              !currentDailyGame.completed &&
              !hardModeCompleted && (
                <div className="space-y-2">
                  <h3 className="font-semibold mb-2">
                    Choose the bird ({currentDailyGame.guesses.length + 1}/
                    {currentDailyGame.maxGuesses}):
                  </h3>
                  {answerOptions.map((bird) => (
                    <button
                      key={bird.id}
                      onClick={() => makeGuess(bird.id)}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium">{bird.name}</div>
                      <div className="text-sm text-gray-500 italic">
                        {bird.scientificName}
                      </div>
                    </button>
                  ))}
                </div>
              )}

            {/* Game completed state */}
            {currentDailyGame && currentDailyGame.completed && (
              <div className="text-center">
                <div
                  className={`text-2xl font-bold mb-4 ${currentDailyGame.won ? "text-green-600" : "text-red-600"}`}
                >
                  {currentDailyGame.won
                    ? "🎉 Well done!"
                    : "😔 Better luck tomorrow!"}
                </div>

                <BirdCompletionCard
                  bird={todaysBird}
                  selectedAudioIndex={selectedAudioIndex}
                  onShare={handleShareResult}
                  variant="normal"
                />
              </div>
            )}
          </div>

          {/* Countdown to next bird */}
          <div className="text-center text-sm text-gray-500">
            Next bird in: <CountdownToMidnight />
          </div>
        </div>
      </div>
    );
  };

  // Main render logic
  if (!selectedRegion) {
    return renderRegionSelector();
  }

  if (currentView === VIEWS.MODE_SELECTOR) {
    return renderModeSelector();
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
    return (
      <HardModeGame
        region={selectedRegion}
        birds={birds}
        todaysBird={todaysBird}
        onBack={() => setCurrentView(VIEWS.MODE_SELECTOR)}
      />
    );
  }

  if (currentView === VIEWS.SETTINGS) {
    return renderSettings();
  }

  if (currentView === VIEWS.STATS) {
    return renderStats();
  }

  return renderGame();
}

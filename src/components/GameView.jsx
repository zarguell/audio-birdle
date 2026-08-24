import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  ArrowLeft,
  Settings,
  Volume2,
  RefreshCw,
  Target,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
} from "lucide-react";
import { SubregionDisplay } from "../utils/SubregionUtils";
import { getAudioSrc } from "../utils/AudioUtils";
import { formatDateForDisplay, getTodayString } from "../utils/DateUtils";
import BirdCompletionCard from "../utils/BirdCompletionCard";
import CountdownToMidnight from "../utils/CountdownToMidnight";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { useGameStore } from "../stores/gameStore";
import { generateAnswerOptions } from "../utils/GameLogic";
import { GAME_CONFIG } from "../utils/Constants";
import HardModeInput from "../utils/HardModeInput";
import TaxonomicBadge from "../utils/TaxonomicBadge";
import { extractGenus, compareTaxonomy } from "../utils/TaxonomyUtils";
import {
  generateShareText,
  generateHardModeShareText,
  shareResult,
} from "../utils/ShareUtils";
import {
  createInitialPracticeState,
  getPracticeBird,
  generatePracticeAnswerOptions,
  processPracticeGuess,
  processHardPracticeGuess,
  startNewPracticeRound,
} from "../utils/PracticeGameLogic";

const colorClasses = {
  blue: {
    bg: "bg-blue-500",
    hover: "hover:bg-blue-600",
    bgLight: "bg-blue-50",
    text: "text-blue-500",
    textDark: "text-blue-700",
    ring: "focus:ring-blue-500",
    gradient: "from-blue-50 to-green-50",
    border: "border-blue-200",
    hoverBg: "hover:bg-blue-50",
  },
  red: {
    bg: "bg-red-500",
    hover: "hover:bg-red-600",
    bgLight: "bg-red-50",
    text: "text-red-500",
    textDark: "text-red-700",
    ring: "focus:ring-red-500",
    gradient: "from-red-50 to-orange-50",
    border: "border-red-200",
    hoverBg: "hover:bg-red-50",
  },
  purple: {
    bg: "bg-purple-500",
    hover: "hover:bg-purple-600",
    bgLight: "bg-purple-50",
    text: "text-purple-500",
    textDark: "text-purple-700",
    ring: "focus:ring-purple-500",
    gradient: "from-purple-50 to-pink-50",
    border: "border-purple-200",
    hoverBg: "hover:bg-purple-50",
  },
};

export default function GameView({
  mode = "normal",
  isPractice = false,
  region,
  today,
  regions,
  todaysBird,
  birds,
  onBack,
  onNavigateSettings,
  onNavigatePractice,
  onNavigateHard,
  dataConsistencyError = null,
  hasUpdate = false,
  refreshingData = false,
  handleForceRefresh = null,
  hardModeCompleted = false,
  normalModeCompleted = false,
}) {
  const {
    isPlaying,
    audioError,
    setAudioError,
    selectedAudioIndex,
    setSelectedAudioIndex,
    audioRef,
    toggleAudio,
    handleAudioError,
    handleAudioEnded,
  } = useAudioPlayer();

  const [practiceState, setPracticeState] = useState(null);
  const [practiceIsHardMode, setPracticeIsHardMode] = useState(false);
  // Mirrors practiceIsHardMode so the init effect (which must NOT depend on
  // practiceIsHardMode, otherwise toggling re-runs it and wipes the round)
  // can still read the current mode when (re)creating the session.
  const practiceIsHardModeRef = useRef(practiceIsHardMode);

  useEffect(() => {
    practiceIsHardModeRef.current = practiceIsHardMode;
  }, [practiceIsHardMode]);

  useEffect(() => {
    if (isPractice && region && birds[region]) {
      const isHard = practiceIsHardModeRef.current;
      const initialState = createInitialPracticeState(region, isHard);
      const firstBird = getPracticeBird(region, birds, 0);
      if (firstBird) {
        let answerOptions = [];
        if (!isHard) {
          answerOptions = generatePracticeAnswerOptions(
            region,
            birds,
            0,
            firstBird,
          );
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPracticeState({
          ...initialState,
          currentBird: firstBird,
          answerOptions,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberate: init only on session start / region / birds change; toggling hard/normal must preserve the current round
  }, [isPractice, region, birds]);

  const gameKey = `${region}-${today}-${mode}`;
  const rawDailyGame = useGameStore((state) => state.getDailyGame(gameKey));
  const dailyGame = isPractice ? null : rawDailyGame;

  useEffect(() => {
    if (!isPractice && region && today && !dailyGame) {
      const key = `${region}-${today}-${mode}`;
      const existing = useGameStore.getState().getDailyGame(key);
      if (!existing) {
        useGameStore.getState().setDailyGame(key, {
          region,
          date: today,
          mode,
          guesses: [],
          completed: false,
          won: false,
          maxGuesses:
            mode === "hard"
              ? GAME_CONFIG.HARD_MODE_MAX_GUESSES
              : GAME_CONFIG.MAX_GUESSES,
        });
      }
    }
  }, [isPractice, region, today, mode, dailyGame]);

  const answerOptions = useMemo(() => {
    if (isPractice) {
      return practiceState?.answerOptions || [];
    }
    if (mode === "hard") return [];
    return generateAnswerOptions(
      region,
      birds,
      today,
      todaysBird,
      GAME_CONFIG.ANSWER_OPTIONS_COUNT,
    );
  }, [
    isPractice,
    mode,
    region,
    birds,
    today,
    todaysBird,
    practiceState?.answerOptions,
  ]);

  const currentBird = isPractice ? practiceState?.currentBird : todaysBird;

  // Reset audio selection when the displayed bird changes. Must come after the
  // currentBird declaration: the deps array is evaluated during render.
  useEffect(() => {
    if (currentBird) {
      setSelectedAudioIndex(0);
      setAudioError(false);
    }
  }, [currentBird, setSelectedAudioIndex, setAudioError]);

  const theme = isPractice
    ? practiceIsHardMode
      ? "red"
      : "purple"
    : mode === "hard"
      ? "red"
      : "blue";
  const c = colorClasses[theme];

  const handleNormalGuess = useCallback(
    (birdId) => {
      if (isPractice) {
        if (!practiceState || !practiceState.currentBird) return;
        const newState = processPracticeGuess(practiceState, birdId);
        setPracticeState(newState);
      } else {
        if (!todaysBird || !region) return;
        useGameStore.getState().processGuess(`${region}-${today}-normal`, {
          birdId,
          correct: birdId === todaysBird.id,
          timestamp: Date.now(),
        });
      }
    },
    [isPractice, practiceState, region, today, todaysBird],
  );

  const handleHardGuess = useCallback(
    (bird) => {
      if (isPractice) {
        if (!practiceState || !practiceState.currentBird || !birds[region])
          return;
        const newState = processHardPracticeGuess(
          practiceState,
          bird.name,
          birds[region],
        );
        setPracticeState(newState);
      } else {
        if (!todaysBird || !region) return;
        const taxonomicScore = compareTaxonomy(bird, todaysBird);
        useGameStore.getState().processGuess(`${region}-${today}-hard`, {
          birdId: bird.id,
          textInput: bird.name,
          correct: bird.id === todaysBird.id,
          timestamp: Date.now(),
          taxonomicScore,
        });
      }
    },
    [isPractice, practiceState, region, today, todaysBird, birds],
  );

  const startNextRound = useCallback(() => {
    if (!practiceState) return;
    const newState = startNewPracticeRound(practiceState, birds);
    setPracticeState(newState);
  }, [practiceState, birds]);

  const restartCurrentRound = useCallback(() => {
    if (!practiceState || !practiceState.currentBird) return;
    let answerOptions = [];
    if (!practiceState.isHardMode) {
      answerOptions = generatePracticeAnswerOptions(
        practiceState.region,
        birds,
        practiceState.practiceIndex,
        practiceState.currentBird,
      );
    }
    setPracticeState({
      ...practiceState,
      guesses: [],
      completed: false,
      won: false,
      answerOptions,
      startTime: new Date().toISOString(),
      endTime: null,
    });
  }, [practiceState, birds]);

  const togglePracticeMode = useCallback(() => {
    setPracticeIsHardMode((prev) => !prev);
    // Preserve the current round (bird / index / guesses); only the mode for
    // the current and future rounds changes.
    setPracticeState((prev) => {
      if (!prev) return prev;
      const nextIsHard = !prev.isHardMode;
      return {
        ...prev,
        isHardMode: nextIsHard,
        maxGuesses: nextIsHard
          ? GAME_CONFIG.HARD_MODE_MAX_GUESSES
          : GAME_CONFIG.MAX_GUESSES,
      };
    });
  }, []);

  const handleShare = useCallback(async () => {
    if (isPractice) return;
    if (!dailyGame || !todaysBird) return;
    const url = window.location.href;
    const text =
      mode === "hard"
        ? generateHardModeShareText(dailyGame, url)
        : generateShareText(dailyGame, url);
    await shareResult(text);
  }, [isPractice, dailyGame, todaysBird, mode]);

  const game = isPractice ? practiceState : dailyGame;
  const guesses = game?.guesses || [];
  const completed = game?.completed || false;
  const won = game?.won || false;

  const regionName = regions.find((r) => r.id === region)?.name || region;

  const isLoading =
    isPractice && (!practiceState || !practiceState.currentBird);

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${c.gradient} p-4`}>
        <div className="max-w-md mx-auto pt-8">
          <div className="flex items-center gap-2 mb-6">
            <button onClick={onBack} className={`${c.text} hover:opacity-80`}>
              {"\u2190"} Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              {isPractice
                ? "\uD83C\uDFAF Practice Mode"
                : mode === "hard"
                  ? "\uD83D\uDD25 Hard Mode"
                  : "\uD83D\uDC26 Audio-Birdle"}
            </h1>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <p className="text-gray-600">Loading practice session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentBird && !dataConsistencyError) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${c.gradient} p-4`}>
        <div className="max-w-md mx-auto pt-8">
          <button
            onClick={onBack}
            aria-label="Back"
            className="text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <p className="text-gray-600">Loading today's bird...</p>
          </div>
        </div>
      </div>
    );
  }

  const renderHeader = () => {
    if (isPractice) {
      return (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className={`${c.text} hover:opacity-80`}>
              {"\u2190"} Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              {practiceIsHardMode
                ? "\uD83D\uDD25 Hard Practice"
                : "\uD83C\uDFAF Practice Mode"}
            </h1>
          </div>
          <button
            onClick={togglePracticeMode}
            className={`${c.bg} ${c.hover} text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm`}
          >
            <Target className="w-4 h-4" />
            {practiceIsHardMode ? "Normal" : "Hard"}
          </button>
        </div>
      );
    }

    if (mode === "hard") {
      return (
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            aria-label="Back"
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            {"\uD83D\uDD25"} Hard Mode
          </h1>
          {hasUpdate && (
            <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
              Update Available
            </div>
          )}
          <div className="w-6"></div>
        </div>
      );
    }

    return (
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">
            {"\uD83D\uDC26"} Audio-Birdle
          </h1>
          {hasUpdate && (
            <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
              Update Available
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onNavigateHard && (
            <button
              onClick={onNavigateHard}
              disabled={completed || hardModeCompleted}
              className={`${
                completed || hardModeCompleted
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700"
              } text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm`}
            >
              <Target className="w-4 h-4" />
              Hard Mode
            </button>
          )}
          {onNavigatePractice && (
            <button
              onClick={onNavigatePractice}
              className="bg-purple-500 text-white px-3 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 text-sm"
            >
              <Target className="w-4 h-4" />
              Practice
            </button>
          )}
          <button
            onClick={onBack}
            className="bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2 text-sm"
          >
            Change Mode
          </button>
          {onNavigateSettings && (
            <button
              onClick={onNavigateSettings}
              aria-label="Settings"
              className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${c.gradient} p-4`}>
      <div className="max-w-md mx-auto pt-8">
        {renderHeader()}

        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          {dataConsistencyError && !currentBird && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-6 mb-4">
              <div className="text-center">
                <p className="text-red-800 font-medium mb-2">
                  {"\u26A0\uFE0F"} Data Sync Issue
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

          {!isPractice && mode === "hard" && normalModeCompleted && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 text-center">
                {"\u26A0\uFE0F"} You've already completed Normal Mode today. You
                can't play Hard Mode on the same day.
              </p>
            </div>
          )}

          <div className={isPractice ? "text-center mb-6" : ""}>
            {!isPractice && (
              <>
                <p className="text-gray-600 mb-2">{regionName}</p>
                <p className="text-sm text-gray-500">
                  Daily Bird Challenge {"\u2022"} {formatDateForDisplay(today)}
                </p>
              </>
            )}
            {isPractice && (
              <div className="text-center mb-6">
                <p className="text-gray-600 mb-2">{regionName}</p>
                <p className="text-sm text-gray-500">
                  Practice Round #{(practiceState?.practiceIndex || 0) + 1}
                </p>
              </div>
            )}
          </div>

          <div className="mb-6">
            <div className={`${c.bgLight} rounded-lg p-6 text-center`}>
              <Volume2 className={`w-12 h-12 mx-auto mb-4 ${c.text}`} />

              {currentBird &&
                Array.isArray(currentBird.audioUrl) &&
                currentBird.audioUrl.length > 1 && (
                  <div className="mb-4">
                    <label htmlFor="audio-recording-select" className="sr-only">
                      Select audio recording
                    </label>
                    <select
                      id="audio-recording-select"
                      aria-label="Select audio recording"
                      value={selectedAudioIndex}
                      onChange={(e) => {
                        const newIndex = parseInt(e.target.value);
                        setSelectedAudioIndex(newIndex);
                        if (audioRef.current) {
                          audioRef.current.load();
                        }
                      }}
                      className={`bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none ${c.ring}`}
                    >
                      {currentBird.audioUrl.map((_, index) => (
                        <option key={index} value={index}>
                          Recording {index + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              <audio
                ref={audioRef}
                src={
                  currentBird
                    ? getAudioSrc(currentBird.audioUrl, selectedAudioIndex)
                    : ""
                }
                onEnded={handleAudioEnded}
                onError={() =>
                  handleAudioError((currentBird?.audioUrl?.length || 1) - 1)
                }
                onLoadStart={() => setAudioError(false)}
                preload="none"
                key={`${currentBird?.id || "bird"}-${selectedAudioIndex}`}
              />

              <button
                onClick={toggleAudio}
                disabled={!currentBird}
                className={`${c.bg} ${c.hover} text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto transition-colors disabled:bg-gray-300`}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                {isPlaying ? "Pause" : "Play"} Bird Call
              </button>

              {audioError && (
                <p className="text-red-500 text-sm mt-2">
                  {isPractice
                    ? "Audio failed to load - try selecting a different recording"
                    : "Audio did not load - please try reloading the page"}
                </p>
              )}
            </div>
          </div>

          {!isPractice && currentBird && (
            <div
              className={`${c.bgLight} rounded-lg p-3 mb-4 border ${c.border}`}
            >
              <p className="text-sm text-gray-700">
                {"\uD83D\uDCA1"} This bird was observed in the last 14 days on
                eBird in{" "}
                <span className={`font-semibold ${c.textDark}`}>
                  <SubregionDisplay
                    selectedRegion={region}
                    today={today || getTodayString()}
                  />
                </span>
                !
              </p>
            </div>
          )}

          {guesses.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Your Guesses:</h3>
              <div className="space-y-2">
                {guesses.map((guess, index) => {
                  if (guess.taxonomicScore) {
                    const guessedBird = guess.birdId
                      ? birds[region]?.find((b) => b.id === guess.birdId)
                      : null;
                    const genus = guessedBird
                      ? extractGenus(guessedBird.scientificName)
                      : null;
                    return (
                      <div
                        key={index}
                        className="bg-gray-50 rounded-lg p-3 border-2 border-gray-200"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-medium">{guess.textInput}</div>
                            {guessedBird && (
                              <div className="text-sm text-gray-500 italic">
                                {guessedBird.scientificName}
                              </div>
                            )}
                          </div>
                          {!guess.correct && (
                            <div className="text-2xl">{"\u274C"}</div>
                          )}
                          {guess.correct && (
                            <div className="text-2xl">{"\u2705"}</div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <TaxonomicBadge
                            label="Order"
                            correct={guess.taxonomicScore.order}
                            show={true}
                            value={guessedBird?.order}
                          />
                          <TaxonomicBadge
                            label="Family"
                            correct={guess.taxonomicScore.family}
                            show={true}
                            value={guessedBird?.family}
                          />
                          <TaxonomicBadge
                            label="Genus"
                            correct={guess.taxonomicScore.genus}
                            show={true}
                            value={genus}
                          />
                          <TaxonomicBadge
                            label="Species"
                            correct={guess.taxonomicScore.species}
                            show={true}
                          />
                        </div>
                      </div>
                    );
                  }

                  const guessedBird = answerOptions.find(
                    (b) => b.id === guess.birdId,
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
                          {guess.correct ? "\u2705" : "\u274C"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!completed && (mode === "hard" || practiceState?.isHardMode) && (
            <div className="text-center mb-4 text-gray-600">
              {GAME_CONFIG.HARD_MODE_MAX_GUESSES - guesses.length}{" "}
              {GAME_CONFIG.HARD_MODE_MAX_GUESSES - guesses.length === 1
                ? "guess"
                : "guesses"}{" "}
              remaining
            </div>
          )}

          {!completed &&
            (mode === "hard" || practiceState?.isHardMode) &&
            guesses.length >= 1 && (
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 mb-4">
                <h4 className="font-semibold text-yellow-800 mb-2">
                  {"\uD83D\uDD0D"} Taxonomic Hints:
                </h4>
                {guesses.length >= GAME_CONFIG.HARD_MODE_HINT_TIMING.ORDER && (
                  <div className="text-sm">
                    <span className="font-medium">Order:</span>{" "}
                    {currentBird?.order}
                  </div>
                )}
                {guesses.length >= GAME_CONFIG.HARD_MODE_HINT_TIMING.FAMILY && (
                  <div className="text-sm mt-1">
                    <span className="font-medium">Family:</span>{" "}
                    {currentBird?.family}
                  </div>
                )}
                {guesses.length >= GAME_CONFIG.HARD_MODE_HINT_TIMING.GENUS && (
                  <div className="text-sm mt-1">
                    <span className="font-medium">Genus:</span>{" "}
                    {currentBird
                      ? extractGenus(currentBird.scientificName)
                      : ""}
                  </div>
                )}
              </div>
            )}

          {!completed &&
            (mode === "normal" ||
              (isPractice && !practiceState?.isHardMode)) && (
              <div className="space-y-2">
                <h3 className="font-semibold mb-2">
                  Choose the bird ({guesses.length + 1}/{game?.maxGuesses || 4}
                  ):
                </h3>
                {answerOptions.map((bird) => (
                  <button
                    key={bird.id}
                    onClick={() => handleNormalGuess(bird.id)}
                    className={`w-full text-left p-3 rounded-lg border border-gray-200 ${c.hoverBg} transition-colors`}
                  >
                    <div className="font-medium">{bird.name}</div>
                    <div className="text-sm text-gray-500 italic">
                      {bird.scientificName}
                    </div>
                  </button>
                ))}
              </div>
            )}

          {!completed && (mode === "hard" || practiceState?.isHardMode) && (
            <HardModeInput
              birds={birds[region] || []}
              onGuess={handleHardGuess}
              placeholder="Type bird name or scientific name..."
            />
          )}

          {completed && (
            <div className="text-center">
              <div
                className={`text-2xl font-bold mb-4 ${won ? "text-green-600" : "text-red-600"}`}
              >
                {won
                  ? "\uD83C\uDF89 Well done!"
                  : isPractice
                    ? "\uD83D\uDE14 Not quite!"
                    : "\uD83D\uDE14 Better luck tomorrow!"}
              </div>

              <BirdCompletionCard
                bird={currentBird}
                selectedAudioIndex={selectedAudioIndex}
                onShare={!isPractice ? handleShare : undefined}
                variant={
                  mode === "hard" ? "hard" : isPractice ? "practice" : "normal"
                }
              />

              {isPractice && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={restartCurrentRound}
                    className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Try Again
                  </button>
                  <button
                    onClick={startNextRound}
                    className={`flex-1 ${c.bg} ${c.hover} text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2`}
                  >
                    Next Bird
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {isPractice ? (
          <div className="text-center text-sm text-gray-500">
            <p>Practice Mode {"\u2022"} Stats not saved</p>
            <p>Keep practicing to improve your bird identification skills!</p>
          </div>
        ) : (
          <div className="text-center text-sm text-gray-500">
            Next bird in: <CountdownToMidnight />
          </div>
        )}
      </div>
    </div>
  );
}

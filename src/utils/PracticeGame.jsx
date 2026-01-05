import { useState, useEffect, useRef, useMemo } from "react";
import {
  Play,
  Pause,
  Volume2,
  RotateCcw,
  ArrowRight,
  Target,
} from "lucide-react";
import { createAudioControls } from "./AudioUtils";
import {
  createInitialPracticeState,
  getPracticeBird,
  generatePracticeAnswerOptions,
  processPracticeGuess,
  processHardPracticeGuess,
  startNewPracticeRound,
} from "./PracticeGameLogic";
import HardModeInput from "./HardModeInput";
import TaxonomicBadge from "./TaxonomicBadge";
import BirdCompletionCard from "./BirdCompletionCard";
import { GAME_CONFIG } from "./Constants";
import { extractGenus } from "./TaxonomyUtils";

export default function PracticeGame({ region, birds, regions, onBack }) {
  const [practiceState, setPracticeState] = useState(null);
  const [isHardMode, setIsHardMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState(0);
  const audioRef = useRef(null);

  // Initialize practice game when component mounts or mode changes
  useEffect(() => {
    if (region && birds[region]) {
      const initialState = createInitialPracticeState(region, isHardMode);
      const firstBird = getPracticeBird(region, birds, 0);

      if (firstBird) {
        let answerOptions = [];
        if (!isHardMode) {
          answerOptions = generatePracticeAnswerOptions(
            region,
            birds,
            0,
            firstBird,
          );
        }

        setPracticeState({
          ...initialState,
          currentBird: firstBird,
          answerOptions,
        });
      }
    }
  }, [region, birds, isHardMode]);

  // Reset audio index when bird changes
  useEffect(() => {
    setSelectedAudioIndex(0);
    setAudioError(false);
  }, [practiceState?.currentBird]);

  // Audio controls
  // eslint-disable-next-line react-hooks/refs
  const audioControls = useMemo(() => createAudioControls(audioRef), []);

  const toggleAudio = async () => {
    if (isPlaying) {
      audioControls.pauseAudio();
      setIsPlaying(false);
    } else {
      const success = await audioControls.playAudio();
      if (success) {
        setIsPlaying(true);
      } else {
        setAudioError(true);
        setIsPlaying(false);
      }
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const handleAudioError = () => {
    setAudioError(true);
    setIsPlaying(false);
  };

  const makeGuess = (birdId) => {
    if (!practiceState || !practiceState.currentBird) return;

    const newState = processPracticeGuess(practiceState, birdId);
    setPracticeState(newState);
  };

  const makeHardModeGuess = (bird) => {
    if (!practiceState || !practiceState.currentBird) return;

    const newState = processHardPracticeGuess(
      practiceState,
      bird.name,
      birds[region],
    );
    setPracticeState(newState);
  };

  const startNextRound = () => {
    if (!practiceState) return;

    const newState = startNewPracticeRound(practiceState, birds);
    setPracticeState(newState);
  };

  const restartCurrentRound = () => {
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
  };

  const toggleMode = () => {
    setIsHardMode((prev) => !prev);
  };

  if (!practiceState || !practiceState.currentBird) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-4">
        <div className="max-w-md mx-auto pt-8">
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={onBack}
              className="text-purple-500 hover:text-purple-600"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              🎯 Practice Mode
            </h1>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <p>Loading practice session...</p>
          </div>
        </div>
      </div>
    );
  }

  const regionName = regions.find((r) => r.id === region)?.name || region;
  const currentBird = practiceState.currentBird;

  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${isHardMode ? "from-red-50 to-orange-50" : "from-purple-50 to-pink-50"} p-4`}
    >
      <div className="max-w-md mx-auto pt-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className={`${isHardMode ? "text-red-500 hover:text-red-600" : "text-purple-500 hover:text-purple-600"}`}
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-800">
              {isHardMode ? "🔥 Hard Practice" : "🎯 Practice Mode"}
            </h1>
          </div>
          <button
            onClick={toggleMode}
            className={`${
              isHardMode
                ? "bg-red-500 hover:bg-red-600"
                : "bg-purple-500 hover:bg-purple-600"
            } text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm`}
          >
            <Target className="w-4 h-4" />
            {isHardMode ? "Normal" : "Hard"}
          </button>
        </div>

        {/* Game Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <p className="text-gray-600 mb-2">{regionName}</p>
            <p className="text-sm text-gray-500">
              Practice Round #{practiceState.practiceIndex + 1}
            </p>
          </div>

          {/* Audio Player */}
          <div className="mb-6">
            <div
              className={`${isHardMode ? "bg-red-50" : "bg-purple-50"} rounded-lg p-6 text-center`}
            >
              <Volume2
                className={`w-12 h-12 mx-auto mb-4 ${isHardMode ? "text-red-400" : "text-purple-400"}`}
              />

              {/* Audio Selection */}
              {currentBird &&
                Array.isArray(currentBird.audioUrl) &&
                currentBird.audioUrl.length > 1 && (
                  <div className="mb-4">
                    <select
                      value={selectedAudioIndex}
                      onChange={(e) => {
                        const newIndex = parseInt(e.target.value);
                        setSelectedAudioIndex(newIndex);
                        if (audioRef.current) {
                          audioRef.current.load();
                        }
                      }}
                      className={`bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
                        isHardMode
                          ? "focus:ring-red-500"
                          : "focus:ring-purple-500"
                      }`}
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
                  Array.isArray(currentBird.audioUrl)
                    ? typeof currentBird.audioUrl[selectedAudioIndex] ===
                      "object"
                      ? currentBird.audioUrl[selectedAudioIndex]?.url
                      : currentBird.audioUrl[selectedAudioIndex]
                    : currentBird.audioUrl
                }
                onEnded={handleAudioEnded}
                onError={handleAudioError}
                onLoadStart={() => setAudioError(false)}
                preload="none"
                key={`${currentBird.id}-${selectedAudioIndex}`}
              />

              <button
                onClick={toggleAudio}
                disabled={audioError}
                className={`${isHardMode ? "bg-red-500 hover:bg-red-600" : "bg-purple-500 hover:bg-purple-600"} text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto transition-colors disabled:bg-gray-300`}
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
                  Audio failed to load - try selecting a different recording
                </p>
              )}
            </div>
          </div>

          {/* Previous Guesses */}
          {practiceState.guesses.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Your Guesses:</h3>
              <div className="space-y-2">
                {practiceState.guesses.map((guess, index) => {
                  // Hard mode guesses
                  if (practiceState.isHardMode) {
                    const guessedBird = birds[region].find(
                      (bird) => bird.id === guess.birdId,
                    );
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
                          {!guess.correct && <div className="text-2xl">❌</div>}
                          {guess.correct && <div className="text-2xl">✅</div>}
                        </div>

                        {/* Taxonomic Score Indicators */}
                        <div className="flex flex-wrap gap-2">
                          <TaxonomicBadge
                            label="Order"
                            correct={guess.taxonomicScore.order}
                            show={
                              index >=
                              GAME_CONFIG.HARD_MODE_HINT_TIMING.ORDER - 1
                            }
                          />
                          <TaxonomicBadge
                            label="Family"
                            correct={guess.taxonomicScore.family}
                            show={
                              index >=
                              GAME_CONFIG.HARD_MODE_HINT_TIMING.FAMILY - 1
                            }
                          />
                          <TaxonomicBadge
                            label="Genus"
                            correct={guess.taxonomicScore.genus}
                            show={
                              index >=
                              GAME_CONFIG.HARD_MODE_HINT_TIMING.GENUS - 1
                            }
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

                  // Normal mode guesses
                  const guessedBird = practiceState.answerOptions.find(
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

          {/* Answer Options - Normal Mode Only */}
          {!practiceState.completed && !practiceState.isHardMode && (
            <div className="space-y-2">
              <h3 className="font-semibold mb-2">
                Choose the bird ({practiceState.guesses.length + 1}/
                {practiceState.maxGuesses}):
              </h3>
              {practiceState.answerOptions.map((bird) => (
                <button
                  key={bird.id}
                  onClick={() => makeGuess(bird.id)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-purple-50 transition-colors"
                >
                  <div className="font-medium">{bird.name}</div>
                  <div className="text-sm text-gray-500 italic">
                    {bird.scientificName}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Progressive Hints - Hard Mode Only */}
          {!practiceState.completed &&
            practiceState.isHardMode &&
            practiceState.guesses.length >= 1 && (
              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 mb-4">
                <h4 className="font-semibold text-yellow-800 mb-2">
                  🔍 Taxonomic Hints:
                </h4>
                {practiceState.guesses.length >=
                  GAME_CONFIG.HARD_MODE_HINT_TIMING.ORDER && (
                  <div className="text-sm">
                    <span className="font-medium">Order:</span>{" "}
                    {currentBird.order}
                  </div>
                )}
                {practiceState.guesses.length >=
                  GAME_CONFIG.HARD_MODE_HINT_TIMING.FAMILY && (
                  <div className="text-sm mt-1">
                    <span className="font-medium">Family:</span>{" "}
                    {currentBird.family}
                  </div>
                )}
                {practiceState.guesses.length >=
                  GAME_CONFIG.HARD_MODE_HINT_TIMING.GENUS && (
                  <div className="text-sm mt-1">
                    <span className="font-medium">Genus:</span>{" "}
                    {extractGenus(currentBird.scientificName)}
                  </div>
                )}
              </div>
            )}

          {/* Input for Active Game - Hard Mode Only */}
          {!practiceState.completed && practiceState.isHardMode && (
            <HardModeInput
              birds={birds[region]}
              onGuess={makeHardModeGuess}
              placeholder="Type bird name or scientific name..."
            />
          )}

          {/* Game Status - Hard Mode Only */}
          {practiceState.isHardMode && !practiceState.completed && (
            <div className="text-center mb-4 text-gray-600">
              {GAME_CONFIG.HARD_MODE_MAX_GUESSES - practiceState.guesses.length}{" "}
              {GAME_CONFIG.HARD_MODE_MAX_GUESSES -
                practiceState.guesses.length ===
              1
                ? "guess"
                : "guesses"}{" "}
              remaining
            </div>
          )}

          {/* Results */}
          {practiceState.completed && (
            <div className="text-center">
              <div
                className={`text-2xl font-bold mb-4 ${practiceState.won ? "text-green-600" : "text-red-600"}`}
              >
                {practiceState.won ? "🎉 Correct!" : "😔 Not quite!"}
              </div>

              <BirdCompletionCard
                bird={currentBird}
                selectedAudioIndex={selectedAudioIndex}
                variant={isHardMode ? "hard" : "practice"}
              />

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
                  className={`flex-1 ${isHardMode ? "bg-red-500 hover:bg-red-600" : "bg-purple-500 hover:bg-purple-600"} text-white py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2`}
                >
                  Next Bird
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Stats Display */}
        <div className="text-center text-sm text-gray-500">
          <p>Practice Mode • Stats not saved</p>
          <p>Keep practicing to improve your bird identification skills!</p>
        </div>
      </div>
    </div>
  );
}

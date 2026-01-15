/**
 * HardModeGame - Hard mode view with free-text input and taxonomic hints
 * Red/orange theme to distinguish from normal mode (blue/green) and practice (purple)
 */

import { useState, useRef, useMemo, useEffect } from "react";
import { ArrowLeft, Share2, Volume2 } from "lucide-react";
import HardModeInput from "./HardModeInput";
import TaxonomicBadge from "./TaxonomicBadge";
import BirdCompletionCard from "./BirdCompletionCard";
import { createAudioControls, getAudioSrc } from "./AudioUtils";
import { GAME_CONFIG } from "./Constants";
import { extractGenus } from "./TaxonomyUtils";
import { getTodayString } from "./DateUtils";
import { generateHardModeShareText, shareResult } from "./ShareUtils";
import { SubregionDisplay } from "./SubregionUtils";
import { useHardModeStore } from "../stores/hardModeStore";

export default function HardModeGame({
  region,
  birds,
  todaysBird,
  onBack,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState(0);
  const audioRef = useRef(null);

  const today = getTodayString();
  const hardModeGame = useHardModeStore((state) => state.getHardModeGame(`${region}-${today}`));

  // Reset audio index when bird changes
  useEffect(() => {
    setSelectedAudioIndex(0);
    setAudioError(false);
  }, [todaysBird]);

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

  const handleGuess = (bird) => {
    const taxonomicScore = {
      order: bird.order === todaysBird.order,
      family: bird.family === todaysBird.family,
      genus: bird.genus === todaysBird.genus,
      species: bird.scientificName === todaysBird.scientificName,
    };

    useHardModeStore.getState().processHardModeGuess(`${region}-${today}`, {
      birdId: bird.id,
      textInput: bird.name,
      correct: bird.id === todaysBird.id,
      timestamp: Date.now(),
      taxonomicScore,
    });
  };

  const handleShare = async () => {
    if (!hardModeGame || !todaysBird) return;

    const shareText = generateHardModeShareText(
      hardModeGame,
      window.location.href,
    );

    await shareResult(shareText);
  };

  const remainingGuesses =
    GAME_CONFIG.HARD_MODE_MAX_GUESSES - (hardModeGame?.guesses.length || 0);

  if (!todaysBird) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="max-w-md mx-auto px-4 py-6">
          <button
            onClick={onBack}
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">🔥 Hard Mode</h1>
          <div className="w-6"></div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          {/* Warning if normal mode already completed */}
          {normalModeCompleted && (
            <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800 text-center">
                ⚠️ You've already completed Normal Mode today. You can't play
                Hard Mode on the same day.
              </p>
            </div>
          )}

          {/* Audio Player */}
          <div className="flex flex-col items-center mb-6">
            <Volume2 className="w-12 h-12 text-gray-600 mb-2" />
            {todaysBird.audioUrl && todaysBird.audioUrl.length > 1 && (
              <select
                value={selectedAudioIndex}
                onChange={(e) =>
                  setSelectedAudioIndex(parseInt(e.target.value))
                }
                className="mb-2 px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                {todaysBird.audioUrl.map((_, index) => (
                  <option key={index} value={index}>
                    Recording {index + 1}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={toggleAudio}
              className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors"
            >
              {isPlaying ? "Pause" : "Play Bird Call"}
            </button>
            {audioError && (
              <p className="text-red-500 text-sm mt-2">
                Error playing audio. Please try again.
              </p>
            )}
            <audio
              ref={audioRef}
              src={getAudioSrc(todaysBird.audioUrl, selectedAudioIndex)}
              onEnded={handleAudioEnded}
              onError={handleAudioError}
            />
          </div>

          {/* Location Hint */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
            <p className="text-sm text-gray-700">
              💡 This bird was observed in the last 14 days on eBird in{" "}
              <span className="font-semibold text-blue-700">
                <SubregionDisplay selectedRegion={region} today={today} />
              </span>
            </p>
          </div>

          {/* Game Status */}
          <div className="text-center mb-4 text-gray-600">
            {hardModeGame?.completed
              ? hardModeGame.won
                ? "🎉 Correct!"
                : "😔 Game Over"
              : `${remainingGuesses} ${remainingGuesses === 1 ? "guess" : "guesses"} remaining`}
          </div>

          {/* Guess History with Taxonomic Scores */}
          <div className="space-y-2 mb-4">
            {hardModeGame?.guesses.map((guess, index) => {
              const guessedBird = guess.birdId
                ? birds[region].find((b) => b.id === guess.birdId)
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
                    {!guess.correct && <div className="text-2xl">❌</div>}
                    {guess.correct && <div className="text-2xl">✅</div>}
                  </div>

                  {/* Taxonomic Score Indicators */}
                  <div className="flex flex-wrap gap-2">
                    <TaxonomicBadge
                      label="Order"
                      correct={guess.taxonomicScore.order}
                      show={
                        index >= GAME_CONFIG.HARD_MODE_HINT_TIMING.ORDER - 1
                      }
                    />
                    <TaxonomicBadge
                      label="Family"
                      correct={guess.taxonomicScore.family}
                      show={
                        index >= GAME_CONFIG.HARD_MODE_HINT_TIMING.FAMILY - 1
                      }
                    />
                    <TaxonomicBadge
                      label="Genus"
                      correct={guess.taxonomicScore.genus}
                      show={
                        index >= GAME_CONFIG.HARD_MODE_HINT_TIMING.GENUS - 1
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
            })}
          </div>

          {/* Progressive Hints */}
          {!hardModeGame?.completed && hardModeGame?.guesses.length >= 1 && (
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 mb-4">
              <h4 className="font-semibold text-yellow-800 mb-2">
                🔍 Taxonomic Hints:
              </h4>
              {hardModeGame.guesses.length >=
                GAME_CONFIG.HARD_MODE_HINT_TIMING.ORDER && (
                <div className="text-sm">
                  <span className="font-medium">Order:</span> {todaysBird.order}
                </div>
              )}
              {hardModeGame.guesses.length >=
                GAME_CONFIG.HARD_MODE_HINT_TIMING.FAMILY && (
                <div className="text-sm mt-1">
                  <span className="font-medium">Family:</span>{" "}
                  {todaysBird.family}
                </div>
              )}
              {hardModeGame.guesses.length >=
                GAME_CONFIG.HARD_MODE_HINT_TIMING.GENUS && (
                <div className="text-sm mt-1">
                  <span className="font-medium">Genus:</span>{" "}
                  {extractGenus(todaysBird.scientificName)}
                </div>
              )}
            </div>
          )}

          {/* Input for Active Game */}
          {!hardModeGame?.completed && !normalModeCompleted && (
            <HardModeInput
              birds={birds[region]}
              onGuess={handleGuess}
              placeholder="Type bird name or scientific name..."
            />
          )}

          {/* Completed Game Actions */}
          {hardModeGame?.completed && (
            <div className="space-y-2">
              <div
                className={`text-2xl font-bold text-center mb-2 ${hardModeGame.won ? "text-green-600" : "text-red-600"}`}
              >
                {hardModeGame.won ? "🎉 Correct!" : "😔 Game Over"}
              </div>

              <BirdCompletionCard
                bird={todaysBird}
                selectedAudioIndex={selectedAudioIndex}
                onShare={handleShare}
                variant="hard"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

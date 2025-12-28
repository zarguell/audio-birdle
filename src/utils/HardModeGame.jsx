/**
 * HardModeGame - Hard mode view with free-text input and taxonomic hints
 * Red/orange theme to distinguish from normal mode (blue/green) and practice (purple)
 */

import { useState, useRef, useMemo, useEffect } from 'react';
import { ArrowLeft, Share2, Volume2 } from 'lucide-react';
import HardModeInput from './HardModeInput';
import TaxonomicBadge from './TaxonomicBadge';
import { createAudioControls } from './AudioUtils';
import { GAME_CONFIG } from './Constants';
import { extractGenus } from './TaxonomyUtils';
import { getTodayString } from './DateUtils';
import { generateHardModeShareText, shareResult } from './ShareUtils';
import { SubregionDisplay } from './SubregionUtils';

export default function HardModeGame({
  region,
  birds,
  todaysBird,
  gameState,
  onBack,
  onGuess,
  onShare
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [selectedAudioIndex, setSelectedAudioIndex] = useState(0);
  const audioRef = useRef(null);

  const today = getTodayString();
  const hardModeGame = gameState?.hardModeGames?.[`${region}-${today}`];

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
    onGuess(bird);
  };

  const handleShare = async () => {
    if (!hardModeGame || !todaysBird) return;

    const shareText = generateHardModeShareText(
      hardModeGame,
      todaysBird.name,
      window.location.href
    );

    await shareResult(shareText);
    onShare();
  };

  const remainingGuesses = GAME_CONFIG.HARD_MODE_MAX_GUESSES - (hardModeGame?.guesses.length || 0);

  if (!todaysBird) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="max-w-md mx-auto px-4 py-6">
          <button onClick={onBack} className="text-gray-600 hover:text-gray-800 mb-4">
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
          <button onClick={onBack} className="text-gray-600 hover:text-gray-800">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">🔥 Hard Mode</h1>
          <div className="w-6"></div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">

          {/* Audio Player */}
          <div className="flex flex-col items-center mb-6">
            <Volume2 className="w-12 h-12 text-gray-600 mb-2" />
            {todaysBird.audioUrl && todaysBird.audioUrl.length > 1 && (
              <select
                value={selectedAudioIndex}
                onChange={(e) => setSelectedAudioIndex(parseInt(e.target.value))}
                className="mb-2 px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                {todaysBird.audioUrl.map((_, index) => (
                  <option key={index} value={index}>Recording {index + 1}</option>
                ))}
              </select>
            )}
            <button
              onClick={toggleAudio}
              className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors"
            >
              {isPlaying ? 'Pause' : 'Play Bird Call'}
            </button>
            {audioError && (
              <p className="text-red-500 text-sm mt-2">Error playing audio. Please try again.</p>
            )}
            <audio
              ref={audioRef}
              src={todaysBird.audioUrl?.[selectedAudioIndex]}
              onEnded={handleAudioEnded}
              onError={handleAudioError}
            />
          </div>

          {/* Location Hint */}
          <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
            <p className="text-sm text-gray-700">
              💡 This bird was observed in the last 14 days on eBird in{' '}
              <span className="font-semibold text-blue-700">
                <SubregionDisplay selectedRegion={region} today={today} />
              </span>
            </p>
          </div>

          {/* Game Status */}
          <div className="text-center mb-4 text-gray-600">
            {hardModeGame?.completed
              ? (hardModeGame.won ? '🎉 Correct!' : '😔 Game Over')
              : `${remainingGuesses} ${remainingGuesses === 1 ? 'guess' : 'guesses'} remaining`
            }
          </div>

          {/* Guess History with Taxonomic Scores */}
          <div className="space-y-2 mb-4">
            {hardModeGame?.guesses.map((guess, index) => {
              const guessedBird = guess.birdId ? birds[region].find(b => b.id === guess.birdId) : null;
              return (
                <div key={index} className="bg-gray-50 rounded-lg p-3 border-2 border-gray-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-medium">{guess.textInput}</div>
                      {guessedBird && (
                        <div className="text-sm text-gray-500 italic">{guessedBird.scientificName}</div>
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
                      show={index >= GAME_CONFIG.HARD_MODE_HINT_TIMING.ORDER - 1}
                    />
                    <TaxonomicBadge
                      label="Family"
                      correct={guess.taxonomicScore.family}
                      show={index >= GAME_CONFIG.HARD_MODE_HINT_TIMING.FAMILY - 1}
                    />
                    <TaxonomicBadge
                      label="Genus"
                      correct={guess.taxonomicScore.genus}
                      show={index >= GAME_CONFIG.HARD_MODE_HINT_TIMING.GENUS - 1}
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
              <h4 className="font-semibold text-yellow-800 mb-2">🔍 Taxonomic Hints:</h4>
              {hardModeGame.guesses.length >= GAME_CONFIG.HARD_MODE_HINT_TIMING.ORDER && (
                <div className="text-sm">
                  <span className="font-medium">Order:</span> {todaysBird.order}
                </div>
              )}
              {hardModeGame.guesses.length >= GAME_CONFIG.HARD_MODE_HINT_TIMING.FAMILY && (
                <div className="text-sm mt-1">
                  <span className="font-medium">Family:</span> {todaysBird.family}
                </div>
              )}
              {hardModeGame.guesses.length >= GAME_CONFIG.HARD_MODE_HINT_TIMING.GENUS && (
                <div className="text-sm mt-1">
                  <span className="font-medium">Genus:</span> {extractGenus(todaysBird.scientificName)}
                </div>
              )}
            </div>
          )}

          {/* Input for Active Game */}
          {!hardModeGame?.completed && (
            <HardModeInput
              birds={birds[region]}
              onGuess={handleGuess}
              placeholder="Type bird name or scientific name..."
            />
          )}

          {/* Completed Game Actions */}
          {hardModeGame?.completed && (
            <div className="space-y-2">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="font-medium">Correct Answer:</p>
                <p className="text-lg font-bold">{todaysBird.name}</p>
                <p className="text-sm italic text-gray-500">{todaysBird.scientificName}</p>
              </div>
              <button
                onClick={handleShare}
                className="w-full bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share Result
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

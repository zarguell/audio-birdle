import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Settings, Share2, Volume2, MapPin, RefreshCw, Info } from 'lucide-react';

// Utility imports
import CountdownToMidnight from './utils/CountdownToMidnight';
import { loadGameData } from './utils/LoadGameData';
import { getTodayString, formatDateForDisplay } from './utils/DateUtils';
import { getStoredData, setStoredData } from './utils/StorageUtils';
import { 
  getDailyBird, 
  generateAnswerOptions, 
  createInitialGameState, 
  processGuess 
} from './utils/GameLogic';
import { generateShareText, shareResult } from './utils/ShareUtils';
import { createAudioControls } from './utils/AudioUtils';
import { STORAGE_KEYS, GAME_CONFIG, VIEWS } from './utils/Constants';

// Main App Component
export default function AudioBirdle() {
  // State management
  const [regions, setRegions] = useState([]);
  const [birds, setBirds] = useState({});
  const [currentView, setCurrentView] = useState(VIEWS.GAME);
  const [selectedRegion, setSelectedRegion] = useState(() => 
    getStoredData(STORAGE_KEYS.REGION, null)
  );
  const [gameState, setGameState] = useState(() => {
    const today = getTodayString();
    const stored = getStoredData(STORAGE_KEYS.GAME_STATE, {});
    
    return stored.date === today ? stored : createInitialGameState(today);
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);

  // Load game data on mount
  useEffect(() => {
    loadGameData()
      .then(({ regions, birds }) => {
        setRegions(regions);
        setBirds(birds);
      })
      .catch(console.error);
  }, []);

  // Get today's bird and options
  const todaysBird = selectedRegion && birds[selectedRegion] 
    ? getDailyBird(selectedRegion, birds[selectedRegion], gameState.date)
    : null;

  const answerOptions = generateAnswerOptions(
    selectedRegion, 
    birds, 
    gameState.date, 
    todaysBird, 
    GAME_CONFIG.ANSWER_OPTIONS_COUNT
  );

  // Save game state when it changes
  useEffect(() => {
    setStoredData(STORAGE_KEYS.GAME_STATE, gameState);
  }, [gameState]);

  // Save selected region
  useEffect(() => {
    if (selectedRegion) {
      setStoredData(STORAGE_KEYS.REGION, selectedRegion);
    }
  }, [selectedRegion]);

  // Audio controls
  const audioControls = createAudioControls(audioRef);

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

  // Game logic
  const makeGuess = (birdId) => {
    const newGameState = processGuess(gameState, birdId, todaysBird?.id);
    setGameState(newGameState);
  };

  // Share functionality
  const handleShareResult = async () => {
    const shareText = generateShareText(gameState, window.location.href);
    await shareResult(shareText);
  };

  // Reset game (for testing)
  const resetGame = () => {
    const newGameState = createInitialGameState(getTodayString());
    setGameState(newGameState);
  };

  // Render components
  const renderRegionSelector = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-16">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">🐦 Audio-Birdle</h1>
          <p className="text-gray-600">Learn birds through their calls</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Select Your Region
          </h2>

          <div className="space-y-2">
            {regions.map(region => (
              <button
                key={region.id}
                onClick={() => setSelectedRegion(region.id)}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {region.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-8">
        <div className="flex items-center gap-2 mb-6">
          <button 
            onClick={() => setCurrentView(VIEWS.GAME)}
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
              {regions.find(r => r.id === selectedRegion)?.name || 'None selected'}
            </div>
          </div>

          <button
            onClick={() => setSelectedRegion(null)}
            className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors"
          >
            Change Region
          </button>

          <button
            onClick={resetGame}
            className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Today's Game
          </button>
        </div>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">🐦 Audio-Birdle</h1>
          <button
            onClick={() => setCurrentView(VIEWS.SETTINGS)}
            className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Game Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <p className="text-gray-600 mb-2">
              {regions.find(r => r.id === selectedRegion)?.name}
            </p>
            <p className="text-sm text-gray-500">
              Daily Bird Challenge • {formatDateForDisplay(gameState.date)}
            </p>
          </div>

          {/* Audio Player */}
          <div className="mb-6">
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <Volume2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              
              {todaysBird && (
                <audio
                  ref={audioRef}
                  src={todaysBird.audioUrl}
                  onEnded={handleAudioEnded}
                  onError={handleAudioError}
                  preload="metadata"
                />
              )}

              <button
                onClick={toggleAudio}
                disabled={!todaysBird || audioError}
                className="bg-blue-500 text-white px-6 py-3 rounded-lg flex items-center gap-2 mx-auto hover:bg-blue-600 transition-colors disabled:bg-gray-300"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isPlaying ? 'Pause' : 'Play'} Bird Call
              </button>

              {audioError && (
                <p className="text-red-500 text-sm mt-2">
                  Audio unavailable - continuing with mock gameplay
                </p>
              )}
            </div>
          </div>

          {/* Guess History */}
          {gameState.guesses.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Your Guesses:</h3>
              <div className="space-y-2">
                {gameState.guesses.map((guess, index) => {
                  const guessedBird = answerOptions.find(bird => bird.id === guess.birdId);
                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-2 ${
                        guess.correct
                          ? 'border-green-500 bg-green-50'
                          : 'border-red-500 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{guessedBird?.name}</span>
                        <span className="text-2xl">
                          {guess.correct ? '✅' : '❌'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Answer Options */}
          {!gameState.completed && (
            <div className="space-y-2">
              <h3 className="font-semibold mb-2">
                Choose the bird ({gameState.guesses.length + 1}/{gameState.maxGuesses}):
              </h3>
              {answerOptions.map(bird => (
                <button
                  key={bird.id}
                  onClick={() => makeGuess(bird.id)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium">{bird.name}</div>
                  <div className="text-sm text-gray-500 italic">{bird.scientificName}</div>
                </button>
              ))}
            </div>
          )}

          {/* Game Results */}
          {gameState.completed && (
            <div className="text-center">
              <div className={`text-2xl font-bold mb-2 ${gameState.won ? 'text-green-600' : 'text-red-600'}`}>
                {gameState.won ? '🎉 Well done!' : '😔 Better luck tomorrow!'}
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h3 className="font-semibold mb-2">Today's Bird:</h3>
                <div className="text-lg font-medium">{todaysBird?.name}</div>
                <div className="text-sm text-gray-500 italic">{todaysBird?.scientificName}</div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleShareResult}
                  className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share Result
                </button>
                
                <button
                  onClick={() => alert('More info about this bird would appear here!')}
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Info className="w-4 h-4" />
                  Learn More
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        <div className="text-center text-sm text-gray-500">
          Next bird in: <CountdownToMidnight />
        </div>
      </div>
    </div>
  );

  // Main render logic
  if (!selectedRegion) {
    return renderRegionSelector();
  }

  if (currentView === VIEWS.SETTINGS) {
    return renderSettings();
  }

  return renderGame();
}
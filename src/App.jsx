
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Settings, Share2, Volume2, MapPin, RefreshCw, Info, BarChart3, Target } from 'lucide-react';

import PracticeGame from './utils/PracticeGame';
import CountdownToMidnight from './utils/CountdownToMidnight';
import { loadGameData } from './utils/LoadGameData';
import { getTodayString, formatDateForDisplay } from './utils/DateUtils';
import { getStoredData, setStoredData } from './utils/StorageUtils';
import {
  getDailyBird,
  getDailyBirdWithFallback,
  generateAnswerOptions,
  createInitialGameState,
  getDailyGameState,
  processGuess,
  hasPlayedRegionDate,
  getUserPerformanceSummary
} from './utils/GameLogic';
import { generateShareText, shareResult } from './utils/ShareUtils';
import { createAudioControls } from './utils/AudioUtils';
import { STORAGE_KEYS, GAME_CONFIG, VIEWS } from './utils/Constants';

export default function AudioBirdle() {
  // Data state
  const [regions, setRegions] = useState([]);
  const [birds, setBirds] = useState({});
  const [currentView, setCurrentView] = useState(VIEWS.GAME);
  const [selectedRegion, setSelectedRegion] = useState(() =>
    getStoredData(STORAGE_KEYS.REGION, null)
  );

  // Game state
  const [gameState, setGameState] = useState(() => {
    const stored = getStoredData(STORAGE_KEYS.GAME_STATE, null);
    return stored || createInitialGameState();
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);

  // Audio selector state
  const [selectedAudioIndex, setSelectedAudioIndex] = useState(0);

  const today = getTodayString();

  // Current daily game state
  const currentDailyGame = selectedRegion ? getDailyGameState(gameState, selectedRegion, today) : null;

  // Load initial data
  useEffect(() => {
    loadGameData()
      .then(({ regions, birds }) => {
        setRegions(regions);
        setBirds(birds);
      })
      .catch(console.error);
  }, []);

  // Bird loading state
  const [todaysBird, setTodaysBird] = useState(null);
  const [loadingBird, setLoadingBird] = useState(false);

  useEffect(() => {
    setSelectedAudioIndex(0);
  }, [todaysBird]);

  // Load today's bird when region changes
  useEffect(() => {
    if (selectedRegion && birds[selectedRegion]) {
      setLoadingBird(true);
      getDailyBirdWithFallback(selectedRegion, birds[selectedRegion], today)
        .then(bird => {
          setTodaysBird(bird);
          setLoadingBird(false);
        })
        .catch(error => {
          console.error('Failed to load today\'s bird:', error);
          // Fallback to deterministic bird selection
          const fallbackBird = getDailyBird(selectedRegion, birds[selectedRegion], today);
          setTodaysBird(fallbackBird);
          setLoadingBird(false);
        });
    }
  }, [selectedRegion, birds, today]);

  // Generate answer options
  const answerOptions = generateAnswerOptions(
    selectedRegion,
    birds,
    today,
    todaysBird,
    GAME_CONFIG.ANSWER_OPTIONS_COUNT
  );

  // Persist game state
  useEffect(() => {
    setStoredData(STORAGE_KEYS.GAME_STATE, gameState);
  }, [gameState]);

  // Persist selected region
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

  // Game actions
  const makeGuess = (birdId) => {
    if (!todaysBird || !selectedRegion) return;

    const newGameState = processGuess(gameState, selectedRegion, today, birdId, todaysBird.id);
    setGameState(newGameState);
  };

  // Share functionality
  const handleShareResult = async () => {
    if (!currentDailyGame) return;

    const shareText = generateShareText(currentDailyGame, window.location.href);
    await shareResult(shareText);
  };

  // Reset functions
  const resetTodaysGame = () => {
    if (!selectedRegion) return;

    const newGameState = { ...gameState };
    const key = `${selectedRegion}-${today}`;
    delete newGameState.dailyGames[key];
    setGameState(newGameState);
  };

  const resetAllData = () => {
    const newGameState = createInitialGameState();
    setGameState(newGameState);
  };

  // Auto-detect location (placeholder)
  const autoDetectLocation = () => {
    // For now, default to US
    setSelectedRegion('us');
  };

  // Region selector view
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
            {regions.map(region => {
              const hasPlayedToday = hasPlayedRegionDate(gameState, region.id, today);
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

  const renderStats = () => {
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
              <h3 className="font-semibold text-lg mb-3">Overall Performance</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalGames}</div>
                  <div className="text-sm text-gray-600">Games Played</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{stats.winRate}%</div>
                  <div className="text-sm text-gray-600">Win Rate</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{stats.averageGuesses}</div>
                  <div className="text-sm text-gray-600">Avg Guesses</div>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{stats.maxStreak}</div>
                  <div className="text-sm text-gray-600">Best Streak</div>
                </div>
              </div>
            </div>

            {/* Regional breakdown */}
            {stats.regionBreakdown.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3">By Region</h3>
                <div className="space-y-2">
                  {stats.regionBreakdown.map(regionStat => {
                    const regionName = regions.find(r => r.id === regionStat.region)?.name || regionStat.region;
                    return (
                      <div key={regionStat.region} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{regionName}</span>
                          <span className="text-sm text-gray-600">{regionStat.games} games</span>
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
            onClick={() => setCurrentView('stats')}
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
        </div>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-md mx-auto pt-8">
        {/* Header with mode toggle */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">🐦 Audio-Birdle</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView(VIEWS.PRACTICE)}
              className="bg-purple-500 text-white px-3 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 text-sm"
            >
              <Target className="w-4 h-4" />
              Practice
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
          <div className="text-center mb-6">
            <p className="text-gray-600 mb-2">
              {regions.find(r => r.id === selectedRegion)?.name}
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
              {todaysBird && Array.isArray(todaysBird.audioUrl) && todaysBird.audioUrl.length > 1 && (
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
                  src={Array.isArray(todaysBird.audioUrl)
                    ? todaysBird.audioUrl[selectedAudioIndex]
                    : todaysBird.audioUrl
                  }
                  onEnded={handleAudioEnded}
                  onError={handleAudioError}
                  onLoadStart={() => {
                    // Reset error state when starting to load
                    setAudioError(false);
                  }}
                  preload="none"
                  key={`${todaysBird.id || 'bird'}-${selectedAudioIndex}`}
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
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    {isPlaying ? 'Pause' : 'Play'} Bird Call
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

          {/* Answer choices */}
          {currentDailyGame && !currentDailyGame.completed && (
            <div className="space-y-2">
              <h3 className="font-semibold mb-2">
                Choose the bird ({currentDailyGame.guesses.length + 1}/{currentDailyGame.maxGuesses}):
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

          {/* Game completed state */}
          {currentDailyGame && currentDailyGame.completed && (
            <div className="text-center">
              <div className={`text-2xl font-bold mb-2 ${currentDailyGame.won ? 'text-green-600' : 'text-red-600'}`}>
                {currentDailyGame.won ? '🎉 Well done!' : '😔 Better luck tomorrow!'}
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

        {/* Countdown to next bird */}
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

  if (currentView === VIEWS.PRACTICE) {
    return (
      <PracticeGame
        region={selectedRegion}
        birds={birds}
        regions={regions}
        onBack={() => setCurrentView(VIEWS.GAME)}
      />
    );
  }

  if (currentView === VIEWS.SETTINGS) {
    return renderSettings();
  }

  if (currentView === 'stats') {
    return renderStats();
  }

  return renderGame();
}

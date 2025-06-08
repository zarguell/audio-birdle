import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Settings, Share2, Volume2, MapPin, RefreshCw, Info } from 'lucide-react';

// Mock data for demonstration - in production, this would come from APIs
const MOCK_REGIONS = [
  { id: 'us-ca', name: 'California, USA', country: 'US' },
  { id: 'us-ny', name: 'New York, USA', country: 'US' },
  { id: 'uk-england', name: 'England, UK', country: 'UK' },
  { id: 'ca-on', name: 'Ontario, Canada', country: 'CA' }
];

const MOCK_BIRDS = {
  'us-ca': [
    { id: 'amro', name: 'American Robin', scientificName: 'Turdus migratorius', audioUrl: 'https://xeno-canto.org//sounds/uploaded/MLFEJSNPJS/XC803375-American-Robin.mp3' },
    { id: 'noca', name: 'Northern Cardinal', scientificName: 'Cardinalis cardinalis', audioUrl: 'https://xeno-canto.org/sounds/uploaded/FHQVLXJQKW/XC1000327-Northern-Cardinal-3.mp3' },
    { id: 'amgo', name: 'American Goldfinch', scientificName: 'Spinus tristis', audioUrl: 'https://xeno-canto.org/sounds/uploaded/MGVGHKBMIZ/XC635390-Goldfinch14.mp3' },
    { id: 'howr', name: 'House Wren', scientificName: 'Troglodytes aedon', audioUrl: 'https://xeno-canto.org/sounds/uploaded/VFMLXNQVNW/XC545291-200128_0468_HouseWren_song_HotelEverlast_Zamora_20200128_0604.mp3' }
  ]
};

// Utility functions
const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const getDailyBird = (region, birds, date) => {
  const seed = hashString(`${region}-${date}`);
  return birds[seed % birds.length];
};

const shuffleArray = (array, seed) => {
  const shuffled = [...array];
  let currentIndex = shuffled.length;
  let randomIndex;

  while (currentIndex !== 0) {
    randomIndex = Math.floor((seed % currentIndex));
    currentIndex--;
    [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
    seed = Math.floor(seed / 2);
  }

  return shuffled;
};

// Storage utilities
const getStoredData = (key, defaultValue) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setStoredData = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

// Main App Component
export default function AudioBirdle() {
  const [currentView, setCurrentView] = useState('game');
  const [selectedRegion, setSelectedRegion] = useState(() => 
    getStoredData('audio-birdle-region', null)
  );
  const [gameState, setGameState] = useState(() => {
    const today = getTodayString();
    const stored = getStoredData('audio-birdle-game-state', {});
    
    if (stored.date === today) {
      return stored;
    }
    
    return {
      date: today,
      guesses: [],
      completed: false,
      won: false,
      maxGuesses: 4
    };
  });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);

  // Get today's bird and options
  const todaysBird = selectedRegion && MOCK_BIRDS[selectedRegion] 
    ? getDailyBird(selectedRegion, MOCK_BIRDS[selectedRegion], gameState.date)
    : null;

  const answerOptions = todaysBird ? shuffleArray(
    MOCK_BIRDS[selectedRegion], 
    hashString(`${selectedRegion}-${gameState.date}-options`)
  ).slice(0, 4) : [];

  // Ensure correct answer is in options
  if (todaysBird && !answerOptions.find(bird => bird.id === todaysBird.id)) {
    answerOptions[0] = todaysBird;
  }

  // Save game state when it changes
  useEffect(() => {
    setStoredData('audio-birdle-game-state', gameState);
  }, [gameState]);

  // Save selected region
  useEffect(() => {
    if (selectedRegion) {
      setStoredData('audio-birdle-region', selectedRegion);
    }
  }, [selectedRegion]);

  // Audio controls
  const toggleAudio = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setAudioError(true);
          setIsPlaying(false);
        });
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
    if (gameState.completed || gameState.guesses.length >= gameState.maxGuesses) return;

    const isCorrect = birdId === todaysBird.id;
    const newGuesses = [...gameState.guesses, { birdId, correct: isCorrect }];
    
    const newGameState = {
      ...gameState,
      guesses: newGuesses,
      completed: isCorrect || newGuesses.length >= gameState.maxGuesses,
      won: isCorrect
    };

    setGameState(newGameState);
  };

  // Generate shareable result
  const generateShareText = () => {
    const emojiGrid = gameState.guesses.map(guess => 
      guess.correct ? '🟩' : '🟥'
    ).join('');
    
    const padding = '⬛'.repeat(gameState.maxGuesses - gameState.guesses.length);
    const result = gameState.won ? `${gameState.guesses.length}/${gameState.maxGuesses}` : 'X/4';
    
    return `🐦 Audio-Birdle ${gameState.date}\n${result}\n\n${emojiGrid}${padding}`;
  };

  const shareResult = async () => {
    const shareText = generateShareText();
    
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText });
      } catch (error) {
        // Fallback to clipboard
        navigator.clipboard?.writeText(shareText);
      }
    } else {
      navigator.clipboard?.writeText(shareText);
    }
  };

  // Reset game (for testing)
  const resetGame = () => {
    const today = getTodayString();
    const newGameState = {
      date: today,
      guesses: [],
      completed: false,
      won: false,
      maxGuesses: 4
    };
    setGameState(newGameState);
  };

  // Auto-detect location (mock implementation)
  const autoDetectLocation = () => {
    // In a real app, this would use geolocation API
    setSelectedRegion('us-ca');
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
          
          <button
            onClick={autoDetectLocation}
            className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg mb-4 flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
          >
            <MapPin className="w-4 h-4" />
            Auto-detect Location
          </button>

          <div className="space-y-2">
            {MOCK_REGIONS.map(region => (
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
            onClick={() => setCurrentView('game')}
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
              {MOCK_REGIONS.find(r => r.id === selectedRegion)?.name || 'None selected'}
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
            onClick={() => setCurrentView('settings')}
            className="p-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Game Card */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="text-center mb-6">
            <p className="text-gray-600 mb-2">
              {MOCK_REGIONS.find(r => r.id === selectedRegion)?.name}
            </p>
            <p className="text-sm text-gray-500">
              Daily Bird Challenge • {new Date().toLocaleDateString()}
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
                  onClick={shareResult}
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
          Next bird in: {new Date(Date.now() + (24 * 60 * 60 * 1000) - (Date.now() % (24 * 60 * 60 * 1000))).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );

  // Main render logic
  if (!selectedRegion) {
    return renderRegionSelector();
  }

  if (currentView === 'settings') {
    return renderSettings();
  }

  return renderGame();
}
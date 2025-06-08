// Game logic utilities
import { hashString, shuffleArray } from './HashUtils';
import { getTodaysBirdFromDaily } from './DailyBirdUtils';

export const getDailyBird = (region, birds, date) => {
  const seed = hashString(`${region}-${date}`);
  return birds[seed % birds.length];
};

export const getDailyBirdWithFallback = async (region, birds, date) => {
  try {
    // Try to get bird from daily.json first
    const dailyBird = await getTodaysBirdFromDaily(region, birds, date);
    if (dailyBird) {
      return dailyBird;
    }
  } catch (error) {
    console.warn('Failed to load from daily.json, using fallback method:', error);
  }
  
  // Fallback to old deterministic method
  return getDailyBird(region, birds, date);
};

export const generateAnswerOptions = (selectedRegion, birds, gameDate, correctBird, optionsCount = 4) => {
  if (!birds[selectedRegion] || !correctBird) return [];
  
  const shuffledBirds = shuffleArray(
    birds[selectedRegion], 
    hashString(`${selectedRegion}-${gameDate}-options`)
  );
  
  const options = shuffledBirds.slice(0, optionsCount);
  
  // Ensure correct answer is in options
  if (!options.find(bird => bird.id === correctBird.id)) {
    options[0] = correctBird;
  }
  
  return options;
};

export const createInitialGameState = (date) => ({
  date,
  guesses: [],
  completed: false,
  won: false,
  maxGuesses: 4
});

export const processGuess = (currentGameState, birdId, correctBirdId) => {
  if (currentGameState.completed || currentGameState.guesses.length >= currentGameState.maxGuesses) {
    return currentGameState;
  }

  const isCorrect = birdId === correctBirdId;
  const newGuesses = [...currentGameState.guesses, { birdId, correct: isCorrect }];
  
  return {
    ...currentGameState,
    guesses: newGuesses,
    completed: isCorrect || newGuesses.length >= currentGameState.maxGuesses,
    won: isCorrect
  };
};
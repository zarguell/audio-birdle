import { hashString } from './HashUtils';
import { GAME_CONFIG } from './Constants';

/**
 * Creates initial state for a practice game session
 */
export const createInitialPracticeState = (region) => {
  return {
    region,
    currentBird: null,
    answerOptions: [],
    guesses: [],
    completed: false,
    won: false,
    maxGuesses: GAME_CONFIG.MAX_GUESSES,
    practiceIndex: 0,
    startTime: new Date().toISOString(),
    endTime: null
  };
};

/**
 * Creates a seeded random generator for consistent results
 */
const createSeededRandom = (seed) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state % 2147483647) / 2147483647;
  };
};

/**
 * Deterministic shuffle using seed
 */
const deterministicShuffle = (array, seed) => {
  const shuffled = [...array];
  const random = createSeededRandom(seed);

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

/**
 * Gets a practice bird based on region and practice index
 */
export const getPracticeBird = (region, birds, practiceIndex) => {
  if (!birds[region] || birds[region].length === 0) return null;

  const regionBirds = birds[region];
  const seed = hashString(`practice-${region}-${practiceIndex}`);
  const shuffledBirds = deterministicShuffle(regionBirds, seed);
  
  // Use modulo to cycle through birds infinitely
  const index = practiceIndex % shuffledBirds.length;
  return shuffledBirds[index];
};

/**
 * Generates answer options for practice mode
 */
export const generatePracticeAnswerOptions = (region, birds, practiceIndex, correctBird, optionCount = 4) => {
  if (!birds[region] || !correctBird) return [];
  
  const regionBirds = birds[region];
  const seed = hashString(`practice-options-${region}-${practiceIndex}-${correctBird.id}`);
  const random = createSeededRandom(seed);
  
  // Get birds that aren't the correct answer
  const availableBirds = regionBirds.filter(bird => bird.id !== correctBird.id);
  
  // First, try to get birds from the same family as the correct bird
  const sameFamilyBirds = availableBirds.filter(bird => bird.family === correctBird.family);
  
  let selectedWrongBirds = [];
  
  if (sameFamilyBirds.length >= optionCount - 1) {
    // We have enough birds from the same family
    const shuffledSameFamily = deterministicShuffle(sameFamilyBirds, seed);
    selectedWrongBirds = shuffledSameFamily.slice(0, optionCount - 1);
  } else {
    // Not enough birds from same family, use all available same-family birds
    // and fill the rest from the entire available list
    const shuffledSameFamily = deterministicShuffle(sameFamilyBirds, seed);
    selectedWrongBirds = [...shuffledSameFamily];
    
    // Get remaining birds (excluding same family birds and correct bird)
    const remainingBirds = availableBirds.filter(bird => bird.family !== correctBird.family);
    const shuffledRemaining = deterministicShuffle(remainingBirds, seed);
    
    // Add birds from other families to reach the desired count
    const stillNeeded = optionCount - 1 - selectedWrongBirds.length;
    for (let i = 0; i < Math.min(stillNeeded, shuffledRemaining.length); i++) {
      selectedWrongBirds.push(shuffledRemaining[i]);
    }
  }
  
  // Combine and shuffle all options
  const allOptions = [correctBird, ...selectedWrongBirds];
  const finalSeed = hashString(`practice-final-${region}-${practiceIndex}-${correctBird.id}`);
  return deterministicShuffle(allOptions, finalSeed);
};

/**
 * Processes a guess in practice mode
 */
export const processPracticeGuess = (practiceState, guessedBirdId) => {
  if (!practiceState.currentBird || practiceState.completed) {
    return practiceState;
  }

  const isCorrect = guessedBirdId === practiceState.currentBird.id;
  
  const guess = {
    birdId: guessedBirdId,
    correct: isCorrect,
    timestamp: new Date().toISOString()
  };

  const newState = {
    ...practiceState,
    guesses: [...practiceState.guesses, guess]
  };

  // Check if game is complete
  if (isCorrect || newState.guesses.length >= newState.maxGuesses) {
    newState.completed = true;
    newState.won = isCorrect;
    newState.endTime = new Date().toISOString();
  }

  return newState;
};

/**
 * Starts a new practice round
 */
export const startNewPracticeRound = (currentState, birds) => {
  const nextPracticeIndex = currentState.practiceIndex + 1;
  const nextBird = getPracticeBird(currentState.region, birds, nextPracticeIndex);
  
  if (!nextBird) return currentState;

  const answerOptions = generatePracticeAnswerOptions(
    currentState.region,
    birds,
    nextPracticeIndex,
    nextBird,
    GAME_CONFIG.ANSWER_OPTIONS_COUNT
  );

  return {
    ...currentState,
    currentBird: nextBird,
    answerOptions,
    guesses: [],
    completed: false,
    won: false,
    practiceIndex: nextPracticeIndex,
    startTime: new Date().toISOString(),
    endTime: null
  };
};
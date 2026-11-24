import { generatePracticeAnswerOptions, shuffledBirdDeck } from "./answers.js";
import { GAME_CONFIG } from "./constants.js";
import { compareTaxonomy } from "./taxonomy.js";

const maxGuessesFor = (isHardMode) =>
  isHardMode ? GAME_CONFIG.HARD_MODE_MAX_GUESSES : GAME_CONFIG.MAX_GUESSES;

const answerOptionsFor = (region, regionBirds, practiceIndex, bird, isHardMode) =>
  isHardMode
    ? []
    : generatePracticeAnswerOptions(
        region,
        regionBirds,
        practiceIndex,
        bird,
        GAME_CONFIG.ANSWER_OPTIONS_COUNT,
      );

const nextDeckPosition = (session, regionBirds) => {
  let deck = session.deck;
  let deckIndex = session.deckIndex + 1;
  if (deckIndex >= deck.length) {
    deck = shuffledBirdDeck(regionBirds);
    deckIndex = 0;
  }
  return { deck, deckIndex, bird: deck[deckIndex] };
};

export function createPracticeSession(region, regionBirds, { isHardMode = false } = {}) {
  if (!Array.isArray(regionBirds) || regionBirds.length === 0) {
    return null;
  }
  const deck = shuffledBirdDeck(regionBirds);
  const bird = deck[0];
  return {
    region,
    currentBird: bird,
    answerOptions: answerOptionsFor(
      region,
      regionBirds,
      0,
      bird,
      isHardMode,
    ),
    guesses: [],
    completed: false,
    won: false,
    maxGuesses: maxGuessesFor(isHardMode),
    practiceIndex: 0,
    isHardMode,
    deck,
    deckIndex: 0,
    startTime: new Date().toISOString(),
    endTime: null,
  };
}

export function startNextPracticeRound(session, regionBirds) {
  const { deck, deckIndex, bird } = nextDeckPosition(session, regionBirds);
  const practiceIndex = session.practiceIndex + 1;
  return {
    ...session,
    deck,
    deckIndex,
    currentBird: bird,
    answerOptions: answerOptionsFor(
      session.region,
      regionBirds,
      practiceIndex,
      bird,
      session.isHardMode,
    ),
    guesses: [],
    completed: false,
    won: false,
    practiceIndex,
    startTime: new Date().toISOString(),
    endTime: null,
  };
}

export function retryPracticeRound(session, regionBirds) {
  return {
    ...session,
    answerOptions: answerOptionsFor(
      session.region,
      regionBirds,
      session.practiceIndex,
      session.currentBird,
      session.isHardMode,
    ),
    guesses: [],
    completed: false,
    won: false,
    startTime: new Date().toISOString(),
    endTime: null,
  };
}

export function togglePracticeMode(session, regionBirds) {
  const isHardMode = !session.isHardMode;
  return {
    ...session,
    isHardMode,
    maxGuesses: maxGuessesFor(isHardMode),
    answerOptions: answerOptionsFor(
      session.region,
      regionBirds,
      session.practiceIndex,
      session.currentBird,
      isHardMode,
    ),
  };
}

export function processPracticeGuess(session, birdId) {
  if (!session.currentBird || session.completed) {
    return session;
  }
  const correct = birdId === session.currentBird.id;
  const guesses = [
    ...session.guesses,
    { birdId, correct, timestamp: Date.now() },
  ];
  const completed = correct || guesses.length >= session.maxGuesses;
  return {
    ...session,
    guesses,
    completed,
    won: completed ? correct : false,
    endTime: completed ? new Date().toISOString() : null,
  };
}

export function processHardPracticeGuess(session, bird) {
  if (!session.currentBird || session.completed) {
    return session;
  }
  const correct = bird.id === session.currentBird.id;
  const guesses = [
    ...session.guesses,
    {
      birdId: bird.id,
      textInput: bird.name,
      correct,
      taxonomicScore: compareTaxonomy(bird, session.currentBird),
      timestamp: Date.now(),
    },
  ];
  const completed = correct || guesses.length >= session.maxGuesses;
  return {
    ...session,
    guesses,
    completed,
    won: completed ? correct : false,
    endTime: completed ? new Date().toISOString() : null,
  };
}

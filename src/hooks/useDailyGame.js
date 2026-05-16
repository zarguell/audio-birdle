import { useCallback } from "react";
import { useGameStore } from "../stores/gameStore";
import { generateAnswerOptions } from "../utils/GameLogic";
import { GAME_CONFIG } from "../utils/Constants";
import { compareTaxonomy } from "../utils/TaxonomyUtils";

/**
 * Custom hook for daily game state and actions
 * Provides game state access and actions for normal and hard mode
 */
export function useDailyGame(region, today, birds, todaysBird) {
  // Get daily game from store
  const getDailyGame = useCallback(() => {
    if (!region) return null;
    return useGameStore.getState().getDailyGame(`${region}-${today}-normal`);
  }, [region, today]);

  // Process a guess in normal mode
  const makeGuess = useCallback(
    (birdId) => {
      if (!todaysBird || !region) return;

      useGameStore.getState().processGuess(`${region}-${today}-normal`, {
        birdId,
        correct: birdId === todaysBird.id,
        timestamp: Date.now(),
      });
    },
    [region, today, todaysBird],
  );

  // Process a guess in hard mode
  const makeHardModeGuess = useCallback(
    (bird) => {
      if (!todaysBird || !region) return;

      const taxonomicScore = compareTaxonomy(bird, todaysBird);

      useGameStore.getState().processGuess(`${region}-${today}-hard`, {
        birdId: bird.id,
        textInput: bird.name,
        correct: bird.id === todaysBird.id,
        timestamp: Date.now(),
        taxonomicScore,
      });
    },
    [region, today, todaysBird],
  );

  // Reset today's game
  const resetTodaysGame = useCallback(() => {
    if (!region) return;

    const key = `${region}-${today}-normal`;
    useGameStore.getState().setDailyGame(key, {
      region,
      date: today,
      mode: 'normal',
      guesses: [],
      completed: false,
      won: false,
      maxGuesses: 4,
    });
  }, [region, today]);

  // Reset all game data
  const resetAllData = useCallback(() => {
    useGameStore.getState().reset();
  }, []);

  // Get hard mode game
  const getHardModeGame = useCallback(() => {
    if (!region) return null;
    return useGameStore.getState().getDailyGame(`${region}-${today}-hard`);
  }, [region, today]);

  // Generate answer options
  const answerOptions = generateAnswerOptions(
    region,
    birds,
    today,
    todaysBird,
    GAME_CONFIG.ANSWER_OPTIONS_COUNT,
  );

  return {
    getDailyGame,
    makeGuess,
    makeHardModeGuess,
    resetTodaysGame,
    resetAllData,
    getHardModeGame,
    answerOptions,
  };
}

export default useDailyGame;

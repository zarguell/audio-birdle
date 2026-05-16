import { useEffect } from "react";
import { useGameStore } from "../stores/gameStore";

export function useGameInitialization(selectedRegion, today, currentDailyGame) {
  useEffect(() => {
    if (selectedRegion && today && !currentDailyGame) {
      const key = `${selectedRegion}-${today}-normal`;
      const existingGame = useGameStore.getState().getDailyGame(key);
      if (!existingGame) {
        useGameStore.getState().setDailyGame(key, {
          region: selectedRegion,
          date: today,
          mode: 'normal',
          guesses: [],
          completed: false,
          won: false,
          maxGuesses: 4,
        });
      }
    }
  }, [selectedRegion, today, currentDailyGame]);
}

export default useGameInitialization;

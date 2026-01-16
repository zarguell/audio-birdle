import { useEffect } from "react";
import { useNormalGameStore } from "../stores/normalGameStore";

export function useGameInitialization(selectedRegion, today, currentDailyGame) {
  useEffect(() => {
    if (selectedRegion && today && !currentDailyGame) {
      const key = `${selectedRegion}-${today}`;
      const existingGame = useNormalGameStore.getState().getDailyGame(key);
      if (!existingGame) {
        useNormalGameStore.getState().setDailyGame(key, {
          region: selectedRegion,
          date: today,
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

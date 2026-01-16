import { useCallback } from "react";
import { generateShareText, shareResult } from "../utils/ShareUtils";

export function useShareResult(currentDailyGame, todaysBird, selectedRegion) {
  const handleShareResult = useCallback(async () => {
    if (!currentDailyGame || !todaysBird) return;

    const shareText = generateShareText(
      currentDailyGame,
      window.location.href,
      todaysBird.name,
      selectedRegion,
    );

    shareResult(shareText);
  }, [currentDailyGame, todaysBird, selectedRegion]);

  return {
    handleShareResult,
  };
}

export default useShareResult;

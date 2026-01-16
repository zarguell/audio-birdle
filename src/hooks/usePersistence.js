import { useState, useEffect } from "react";
import { getStoredData, setStoredData } from "../utils/StorageUtils";
import { STORAGE_KEYS } from "../utils/Constants";

export function usePersistence() {
  const [selectedRegion, setSelectedRegion] = useState(() =>
    getStoredData(STORAGE_KEYS.REGION, null),
  );
  const [lastPlayedMode, setLastPlayedMode] = useState(() =>
    getStoredData(STORAGE_KEYS.LAST_PLAYED_MODE, "normal"),
  );

  useEffect(() => {
    if (selectedRegion !== null) {
      setStoredData(STORAGE_KEYS.REGION, selectedRegion);
    }
  }, [selectedRegion]);

  useEffect(() => {
    setStoredData(STORAGE_KEYS.LAST_PLAYED_MODE, lastPlayedMode);
  }, [lastPlayedMode]);

  return {
    selectedRegion,
    setSelectedRegion,
    lastPlayedMode,
    setLastPlayedMode,
  };
}

export default usePersistence;

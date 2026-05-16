import { useState, useEffect } from "react";
import { getStorage, setStorage } from "../utils/StorageUtils";
import { STORAGE_KEYS } from "../utils/Constants";

export function usePersistence() {
  const [selectedRegion, setSelectedRegion] = useState(() =>
    getStorage(STORAGE_KEYS.REGION, null),
  );
  const [lastPlayedMode, setLastPlayedMode] = useState(() =>
    getStorage(STORAGE_KEYS.LAST_PLAYED_MODE, "normal"),
  );

  useEffect(() => {
    if (selectedRegion !== null) {
      setStorage(STORAGE_KEYS.REGION, selectedRegion);
    }
  }, [selectedRegion]);

  useEffect(() => {
    setStorage(STORAGE_KEYS.LAST_PLAYED_MODE, lastPlayedMode);
  }, [lastPlayedMode]);

  return {
    selectedRegion,
    setSelectedRegion,
    lastPlayedMode,
    setLastPlayedMode,
  };
}

export default usePersistence;

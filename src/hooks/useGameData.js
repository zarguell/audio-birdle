import { useState, useEffect, useCallback } from "react";
import { loadGameData } from "../utils/LoadGameData";
import { getDailyBirdWithFallback } from "../utils/GameLogic";
import { getTodayString } from "../utils/DateUtils";
import {
  checkForUpdates,
  checkBirdsJsonUpdate,
  hasDateChanged,
  refreshGameData,
  clearServiceWorkerCache,
} from "../utils/CacheUtils";
import {
  loadDeadAudioUrlsCache,
  clearDeadAudioUrlsCache,
} from "../utils/AudioUtils";
import { toast } from "sonner";

/**
 * Custom hook for managing game data loading and refreshing
 */
export function useGameData(initialRegion = null) {
  const [regions, setRegions] = useState([]);
  const [birds, setBirds] = useState({});
  const [todaysBird, setTodaysBird] = useState(null);
  const [loadingBird, setLoadingBird] = useState(false);
  const [dataConsistencyError, setDataConsistencyError] = useState(null);
  const [hasUpdate, setHasUpdate] = useState(false);
  const [refreshingData, setRefreshingData] = useState(false);

  const today = getTodayString();

  // Load initial game data
  useEffect(() => {
    loadDeadAudioUrlsCache();

    loadGameData()
      .then(({ regions: loadedRegions, birds: loadedBirds }) => {
        setRegions(loadedRegions);
        setBirds(loadedBirds);
      })
      .catch((error) => {
        console.error("Failed to load game data:", error);
        toast.error("Failed to load game data. Please refresh the page.");
      });
  }, []);

  // Load today's bird
  const loadTodaysBird = useCallback(() => {
    if (!initialRegion || !birds[initialRegion]) return;

    setLoadingBird(true);
    setDataConsistencyError(null);

    getDailyBirdWithFallback(initialRegion, birds[initialRegion], today)
      .then((result) => {
        if (result.success && result.bird) {
          setTodaysBird(result.bird);
          setDataConsistencyError(null);
        } else {
          setTodaysBird(null);
          setDataConsistencyError(
            result.message || "Failed to load daily challenge",
          );
          toast.error(result.message || "Data sync issue detected.", {
            duration: 5000,
          });
        }
        setLoadingBird(false);
      })
      .catch((error) => {
        console.error("Failed to load today's bird:", error);
        setTodaysBird(null);
        setDataConsistencyError(
          "Failed to load daily challenge. Please refresh.",
        );
        toast.error("Failed to load daily challenge. Please try refreshing.");
        setLoadingBird(false);
      });
  }, [initialRegion, birds, today]);

  // Reload bird when region or birds change
  useEffect(() => {
    if (initialRegion && birds[initialRegion]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- loadTodaysBird is a useCallback that fetches and sets state asynchronously
      loadTodaysBird();
    }
  }, [initialRegion, birds, today, loadTodaysBird]);

  const loadAndSetBird = async (newBirds) => {
    if (!initialRegion || !newBirds[initialRegion]) return;
    setLoadingBird(true);
    const result = await getDailyBirdWithFallback(initialRegion, newBirds[initialRegion], today);
    if (result.success && result.bird) {
      setTodaysBird(result.bird);
      setDataConsistencyError(null);
    } else {
      setTodaysBird(null);
      setDataConsistencyError(result.message || "Failed to load daily challenge");
    }
    setLoadingBird(false);
  };

  // Auto refresh
  const handleAutoRefresh = useCallback(async () => {
    if (!initialRegion) return;

    try {
      await clearServiceWorkerCache();
      const { regions: newRegions, birds: newBirds } = await refreshGameData();
      setRegions(newRegions);
      setBirds(newBirds);

      await loadAndSetBird(newBirds);
    } catch (error) {
      console.error("Auto-refresh failed:", error);
    }
  }, [initialRegion, today]);

  // Check for updates
  useEffect(() => {
    if (!initialRegion) return;

    Promise.all([checkForUpdates(), checkBirdsJsonUpdate()]).then(
      ([updateCheck, birdsCheck]) => {
        const hasNewUpdate = updateCheck.hasUpdate || birdsCheck.hasUpdate;
        setHasUpdate(hasNewUpdate);

        if (
          updateCheck.dailyJsonUpdate ||
          birdsCheck.hasUpdate ||
          hasDateChanged()
        ) {
          console.log("Detected stale data, auto-refreshing...");
          if (birdsCheck.hasUpdate) {
            clearDeadAudioUrlsCache();
          }
          handleAutoRefresh();
        }
      },
    );
  }, [initialRegion, handleAutoRefresh]);

  // Force refresh (user triggered)
  const handleForceRefresh = useCallback(async () => {
    if (!initialRegion) return;

    try {
      await clearServiceWorkerCache();
      const { regions: newRegions, birds: newBirds } = await refreshGameData();
      setRegions(newRegions);
      setBirds(newBirds);

      await loadAndSetBird(newBirds);
    } catch (error) {
      console.error("Force refresh failed:", error);
    }
  }, [initialRegion, today]);

  // Manual refresh
  const handleRefreshData = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error("Cannot refresh data while offline.");
      return;
    }

    setRefreshingData(true);

    try {
      await clearServiceWorkerCache();
      const { regions: newRegions, birds: newBirds } = await refreshGameData();
      setRegions(newRegions);
      setBirds(newBirds);

      await loadAndSetBird(newBirds);

      setHasUpdate(false);
      if (!dataConsistencyError) {
        toast.success("Data refreshed successfully!");
      }
    } catch (error) {
      console.error("Failed to refresh data:", error);
      toast.error("Failed to refresh data. Please try again.");
    } finally {
      setRefreshingData(false);
    }
  }, [initialRegion, today, dataConsistencyError]);

  return {
    regions,
    birds,
    todaysBird,
    loadingBird,
    dataConsistencyError,
    hasUpdate,
    refreshingData,
    loadTodaysBird,
    handleAutoRefresh,
    handleForceRefresh,
    handleRefreshData,
  };
}

export default useGameData;

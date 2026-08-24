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
          // When the fallback (hash-based) bird is served — e.g. offline or
          // daily data out of sync — surface it instead of hiding it: the
          // substituted bird may differ from the official daily answer.
          setDataConsistencyError(
            result.usedFallback ? result.message || null : null,
          );
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

  const loadAndSetBird = useCallback(
    async (newBirds) => {
      if (!initialRegion || !newBirds[initialRegion]) return;
      setLoadingBird(true);
      const result = await getDailyBirdWithFallback(
        initialRegion,
        newBirds[initialRegion],
        today,
      );
      if (result.success && result.bird) {
        setTodaysBird(result.bird);
        setDataConsistencyError(
          result.usedFallback ? result.message || null : null,
        );
      } else {
        setTodaysBird(null);
        setDataConsistencyError(
          result.message || "Failed to load daily challenge",
        );
      }
      setLoadingBird(false);
    },
    [initialRegion, today],
  );

  // Auto refresh
  const handleAutoRefresh = useCallback(async () => {
    if (!initialRegion) return;

    try {
      await clearServiceWorkerCache();
      const { regions: newRegions, birds: newBirds } = await refreshGameData();
      setRegions(newRegions);
      setBirds(newBirds);

      await loadAndSetBird(newBirds);
      // The refresh fetched fresh data and stored its version info — clear
      // the "Update Available" flag, otherwise the banner stays stuck for
      // the whole session (it is only ever set in the update-check effect).
      setHasUpdate(false);
    } catch (error) {
      console.error("Auto-refresh failed:", error);
    }
  }, [initialRegion, today, loadAndSetBird]);

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

  // Roll over at local midnight so an idle tab shows the new day's bird
  // without requiring interaction. handleAutoRefresh is stable (see above),
  // so this timer is only (re)created when the region changes.
  useEffect(() => {
    if (!initialRegion) return;

    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0,
    );
    const timer = setTimeout(() => {
      handleAutoRefresh();
    }, nextMidnight.getTime() - now.getTime());

    return () => clearTimeout(timer);
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
      setHasUpdate(false);
    } catch (error) {
      console.error("Force refresh failed:", error);
    }
  }, [initialRegion, today, loadAndSetBird]);

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
  }, [initialRegion, today, dataConsistencyError, loadAndSetBird]);

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

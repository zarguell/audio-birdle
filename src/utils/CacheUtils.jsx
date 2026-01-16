/**
 * Cache management utilities for PWA data refresh
 */

import { STORAGE_KEYS } from "./Constants";
import {
  checkDataFileUpdate,
  storeDataFileVersion,
  getCachedVersion,
} from "./versionUtils";

const DATA_FILES = [
  "/data/regions.json",
  "/data/birds.json",
  "/data/daily.json",
  "/data/history.json",
  "/data/daily-subregion-birds.json",
];

/**
 * Check if service worker is active and ready
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export const getServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration;
  } catch (error) {
    console.error("Failed to get service worker registration:", error);
    return null;
  }
};

/**
 * Check if daily.json has been updated
 * Critical for daily challenge consistency
 * @returns {Promise<{hasUpdate: boolean, cachedVersion?: string, serverVersion?: string}>}
 */
export const checkDailyJsonUpdate = async () =>
  checkDataFileUpdate(
    "/data/daily.json",
    STORAGE_KEYS.DAILY_JSON_LAST_MODIFIED,
    STORAGE_KEYS.DAILY_JSON_ETAG,
  );

/**
 * Get version information from cached vs fresh data
 * @returns {Promise<{hasUpdate: boolean, cachedVersion?: string, serverVersion?: string, dailyJsonUpdate?: boolean}>}
 */
export const checkForUpdates = async () => {
  const regionsCheck = await checkDataFileUpdate(
    "/data/regions.json",
    STORAGE_KEYS.CACHE_LAST_MODIFIED,
    STORAGE_KEYS.CACHE_ETAG,
  );
  const dailyJsonCheck = await checkDailyJsonUpdate();

  return {
    hasUpdate: regionsCheck.hasUpdate || dailyJsonCheck.hasUpdate,
    serverVersion: regionsCheck.serverVersion,
    cachedVersion: regionsCheck.cachedVersion,
    dailyJsonUpdate: dailyJsonCheck.hasUpdate,
  };
};

/**
 * Store version information after successful data load
 * @param {Response} response - Fetch response from data file
 */
export const storeVersionInfo = (response) =>
  storeDataFileVersion(response, STORAGE_KEYS.CACHE_LAST_MODIFIED, STORAGE_KEYS.CACHE_ETAG);

/**
 * Store daily.json version information after successful load
 * @param {Response} response - Fetch response from daily.json
 */
export const storeDailyJsonVersionInfo = (response) => {
  storeDataFileVersion(response, STORAGE_KEYS.DAILY_JSON_LAST_MODIFIED, STORAGE_KEYS.DAILY_JSON_ETAG);

  // Store today's date as last validated
  const today = new Date().toISOString().split("T")[0];
  localStorage.setItem(STORAGE_KEYS.LAST_VALIDATED_DATE, today);
};

/**
 * Store birds.json version information after successful load
 * Critical for detecting when bird audio URLs have changed
 * @param {Response} response - Fetch response from birds.json
 */
export const storeBirdsJsonVersionInfo = (response) =>
  storeDataFileVersion(response, STORAGE_KEYS.BIRDS_JSON_LAST_MODIFIED, STORAGE_KEYS.BIRDS_JSON_ETAG);

/**
 * Check if birds.json (audio URLs) has been updated
 * @returns {Promise<{hasUpdate: boolean, cachedVersion?: string, serverVersion?: string}>}
 */
export const checkBirdsJsonUpdate = async () =>
  checkDataFileUpdate(
    "/data/birds.json",
    STORAGE_KEYS.BIRDS_JSON_LAST_MODIFIED,
    STORAGE_KEYS.BIRDS_JSON_ETAG,
  );

/**
 * Check if today's date has changed since last validation
 * @returns {boolean} - True if date has changed (new day)
 */
export const hasDateChanged = () => {
  try {
    const lastValidatedDate = localStorage.getItem(STORAGE_KEYS.LAST_VALIDATED_DATE);
    if (!lastValidatedDate) {
      return true; // First time, treat as new day
    }

    const today = new Date().toISOString().split("T")[0];
    return today !== lastValidatedDate;
  } catch (error) {
    console.warn("Failed to check date change:", error);
    return true; // On error, assume date changed
  }
};

/**
 * Clear service worker cache
 * @returns {Promise<boolean>}
 */
export const clearServiceWorkerCache = async () => {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    return true;
  } catch (error) {
    console.error("Failed to clear service worker cache:", error);
    return false;
  }
};

/**
 * Force refresh all game data files
 * @param {Function} onProgress - Callback for progress updates
 * @returns {Promise<{regions: Object, birds: Object}>}
 */
export const refreshGameData = async (onProgress) => {
  const results = {};

  for (let i = 0; i < DATA_FILES.length; i++) {
    const file = DATA_FILES[i];

    if (onProgress) {
      onProgress(i + 1, DATA_FILES.length, file);
    }

    const response = await fetch(file, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${file}: ${response.status}`);
    }

    const data = await response.json();

    // Store in appropriate result key
    if (file.includes("regions.json")) {
      results.regions = data;
      storeVersionInfo(response);
    } else if (file.includes("birds.json")) {
      results.birds = data;
    } else if (file.includes("daily.json")) {
      storeDailyJsonVersionInfo(response);
    }
  }

  return results;
};

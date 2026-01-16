/**
 * Cache management utilities for PWA data refresh
 * Handles service worker cache, data file versioning, and refresh operations
 */

import { STORAGE_KEYS } from "./Constants";
import {
  checkDataFileUpdate,
  storeDataFileVersion,
} from "./versionUtils";
import { isStorageAvailable, setStorage, getStorage } from "./StorageUtils";

const DATA_FILES = [
  "/data/regions.json",
  "/data/birds.json",
  "/data/daily.json",
  "/data/history.json",
  "/data/daily-subregion-birds.json",
];

/**
 * Log error with context prefix
 * @param {string} prefix - Error context
 * @param {Error} error - Error object
 */
const logError = (prefix, error) => {
  console.error(`${prefix}:`, error);
};

/**
 * Check if service worker is active and ready
 * Used before cache operations to verify PWA support
 * @returns {Promise<ServiceWorkerRegistration|null>} Service worker registration or null if unavailable
 */
export const getServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration;
  } catch (error) {
    logError("Failed to get service worker registration", error);
    return null;
  }
};

/**
 * Check if daily.json has been updated
 * Critical for daily challenge consistency - triggers cache refresh when changed
 * @returns {Promise<{hasUpdate: boolean, cachedVersion?: string, serverVersion?: string}>} Update status and version info
 */
export const checkDailyJsonUpdate = async () =>
  checkDataFileUpdate(
    "/data/daily.json",
    STORAGE_KEYS.DAILY_JSON_LAST_MODIFIED,
    STORAGE_KEYS.DAILY_JSON_ETAG,
  );

/**
 * Get version information from cached vs fresh data
 * Checks both regions.json and daily.json for updates
 * @returns {Promise<{hasUpdate: boolean, cachedVersion?: string, serverVersion?: string, dailyJsonUpdate?: boolean}>} Update status and version details
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
 * Saves Last-Modified and ETag headers to localStorage
 * @param {Response} response - Fetch response from data file
 */
export const storeVersionInfo = (response) =>
  storeDataFileVersion(response, STORAGE_KEYS.CACHE_LAST_MODIFIED, STORAGE_KEYS.CACHE_ETAG);

/**
 * Store daily.json version information after successful load
 * Also records today's date as last validated to detect day changes
 * @param {Response} response - Fetch response from daily.json
 */
export const storeDailyJsonVersionInfo = (response) => {
  storeDataFileVersion(response, STORAGE_KEYS.DAILY_JSON_LAST_MODIFIED, STORAGE_KEYS.DAILY_JSON_ETAG);

  if (isStorageAvailable()) {
    const today = new Date().toISOString().split("T")[0];
    setStorage(STORAGE_KEYS.LAST_VALIDATED_DATE, today);
  }
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
 * @returns {Promise<{hasUpdate: boolean, cachedVersion?: string, serverVersion?: string}>} Update status and version info
 */
export const checkBirdsJsonUpdate = async () =>
  checkDataFileUpdate(
    "/data/birds.json",
    STORAGE_KEYS.BIRDS_JSON_LAST_MODIFIED,
    STORAGE_KEYS.BIRDS_JSON_ETAG,
  );

/**
 * Check if today's date has changed since last validation
 * Used to determine if daily challenge should be refreshed
 * @returns {boolean} True if date has changed or no previous validation exists
 */
export const hasDateChanged = () => {
  if (!isStorageAvailable()) {
    return true;
  }

  const lastValidatedDate = getStorage(STORAGE_KEYS.LAST_VALIDATED_DATE, null);
  if (!lastValidatedDate) {
    return true;
  }

  const today = new Date().toISOString().split("T")[0];
  return today !== lastValidatedDate;
};

/**
 * Clear all service worker caches
 * Used to force fresh data load when versions don't match
 * @returns {Promise<boolean>} True if cache cleared successfully, false on error
 */
export const clearServiceWorkerCache = async () => {
  try {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    return true;
  } catch (error) {
    logError("Failed to clear service worker cache", error);
    return false;
  }
};

/**
 * Force refresh all game data files from server
 * Bypasses cache to ensure latest data is loaded
 * @param {Function} [onProgress] - Optional callback(current, total, file) for progress updates
 * @returns {Promise<{regions: Object, birds: Object}>} Loaded regions and birds data
 * @throws {Error} If any data file fails to load
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

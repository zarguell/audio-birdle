/**
 * Cache management utilities for PWA data refresh
 */

import { STORAGE_KEYS } from "./Constants";

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
export const checkDailyJsonUpdate = async () => {
  try {
    const response = await fetch("/data/daily.json", {
      method: "HEAD",
      cache: "no-store",
    });

    const serverLastModified = response.headers.get("Last-Modified");
    const serverETag = response.headers.get("ETag");

    // Get cached daily.json version info from localStorage
    const cachedLastModified = localStorage.getItem(
      STORAGE_KEYS.DAILY_JSON_LAST_MODIFIED,
    );
    const cachedETag = localStorage.getItem(STORAGE_KEYS.DAILY_JSON_ETAG);

    const hasUpdate =
      (serverLastModified && serverLastModified !== cachedLastModified) ||
      (serverETag && serverETag !== cachedETag);

    return {
      hasUpdate,
      serverVersion: serverLastModified || serverETag,
      cachedVersion: cachedLastModified || cachedETag,
    };
  } catch (error) {
    console.warn("Failed to check daily.json for updates:", error);
    return { hasUpdate: false };
  }
};

/**
 * Get version information from cached vs fresh data
 * Compares Last-Modified headers or ETags
 * @returns {Promise<{hasUpdate: boolean, cachedVersion?: string, serverVersion?: string, dailyJsonUpdate?: boolean}>}
 */
export const checkForUpdates = async () => {
  try {
    // Try to fetch regions.json with HEAD request to check version
    // This matches the file we use in loadGameData for version tracking
    const response = await fetch("/data/regions.json", {
      method: "HEAD",
      cache: "no-store",
    });

    const serverLastModified = response.headers.get("Last-Modified");
    const serverETag = response.headers.get("ETag");

    // Get cached version info from localStorage
    const cachedLastModified = localStorage.getItem(
      STORAGE_KEYS.CACHE_LAST_MODIFIED,
    );
    const cachedETag = localStorage.getItem(STORAGE_KEYS.CACHE_ETAG);

    const hasUpdate =
      (serverLastModified && serverLastModified !== cachedLastModified) ||
      (serverETag && serverETag !== cachedETag);

    // Also check daily.json for updates
    const dailyJsonCheck = await checkDailyJsonUpdate();

    return {
      hasUpdate: hasUpdate || dailyJsonCheck.hasUpdate,
      serverVersion: serverLastModified || serverETag,
      cachedVersion: cachedLastModified || cachedETag,
      dailyJsonUpdate: dailyJsonCheck.hasUpdate,
    };
  } catch (error) {
    console.warn("Failed to check for updates:", error);
    return { hasUpdate: false };
  }
};

/**
 * Store version information after successful data load
 * @param {Response} response - Fetch response from data file
 */
export const storeVersionInfo = async (response) => {
  try {
    const lastModified = response.headers.get("Last-Modified");
    const etag = response.headers.get("ETag");

    if (lastModified) {
      localStorage.setItem(STORAGE_KEYS.CACHE_LAST_MODIFIED, lastModified);
    }
    if (etag) {
      localStorage.setItem(STORAGE_KEYS.CACHE_ETAG, etag);
    }
  } catch (error) {
    console.warn("Failed to store version info:", error);
  }
};

/**
 * Store daily.json version information after successful load
 * @param {Response} response - Fetch response from daily.json
 */
export const storeDailyJsonVersionInfo = async (response) => {
  try {
    const lastModified = response.headers.get("Last-Modified");
    const etag = response.headers.get("ETag");

    if (lastModified) {
      localStorage.setItem(STORAGE_KEYS.DAILY_JSON_LAST_MODIFIED, lastModified);
    }
    if (etag) {
      localStorage.setItem(STORAGE_KEYS.DAILY_JSON_ETAG, etag);
    }

    // Store today's date as last validated
    const today = new Date().toISOString().split("T")[0];
    localStorage.setItem(STORAGE_KEYS.LAST_VALIDATED_DATE, today);
  } catch (error) {
    console.warn("Failed to store daily.json version info:", error);
  }
};

/**
 * Store birds.json version information after successful load
 * Critical for detecting when bird audio URLs have changed
 * @param {Response} response - Fetch response from birds.json
 */
export const storeBirdsJsonVersionInfo = async (response) => {
  try {
    const lastModified = response.headers.get("Last-Modified");
    const etag = response.headers.get("ETag");

    if (lastModified) {
      localStorage.setItem(STORAGE_KEYS.BIRDS_JSON_LAST_MODIFIED, lastModified);
    }
    if (etag) {
      localStorage.setItem(STORAGE_KEYS.BIRDS_JSON_ETAG, etag);
    }
  } catch (error) {
    console.warn("Failed to store birds.json version info:", error);
  }
};

/**
 * Check if birds.json (audio URLs) has been updated
 * @returns {Promise<{hasUpdate: boolean, cachedVersion?: string, serverVersion?: string}>}
 */
export const checkBirdsJsonUpdate = async () => {
  try {
    const response = await fetch("/data/birds.json", {
      method: "HEAD",
      cache: "no-store",
    });

    const serverLastModified = response.headers.get("Last-Modified");
    const serverETag = response.headers.get("ETag");

    const cachedLastModified = localStorage.getItem(
      STORAGE_KEYS.BIRDS_JSON_LAST_MODIFIED,
    );
    const cachedETag = localStorage.getItem(STORAGE_KEYS.BIRDS_JSON_ETAG);

    const hasUpdate =
      (serverLastModified && serverLastModified !== cachedLastModified) ||
      (serverETag && serverETag !== cachedETag);

    return {
      hasUpdate,
      serverVersion: serverLastModified || serverETag,
      cachedVersion: cachedLastModified || cachedETag,
    };
  } catch (error) {
    console.warn("Failed to check birds.json for updates:", error);
    return { hasUpdate: false };
  }
};

/**
 * Check if today's date has changed since last validation
 * Used to detect when we need to force a daily.json refresh
 * @returns {boolean} - True if date has changed (new day)
 */
export const hasDateChanged = () => {
  try {
    const lastValidatedDate = localStorage.getItem(
      STORAGE_KEYS.LAST_VALIDATED_DATE,
    );
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
    // Also manually delete caches
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
 * Bypasses service worker cache with cache: 'no-store'
 * @param {Function} onProgress - Callback for progress updates (fileIndex, totalFiles, fileName)
 * @returns {Promise<{regions: Object, birds: Object}>}
 */
export const refreshGameData = async (onProgress) => {
  const results = {};

  for (let i = 0; i < DATA_FILES.length; i++) {
    const file = DATA_FILES[i];

    if (onProgress) {
      onProgress(i + 1, DATA_FILES.length, file);
    }

    try {
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
        // Store version info for regions.json
        await storeVersionInfo(response);
      } else if (file.includes("birds.json")) {
        results.birds = data;
      } else if (file.includes("daily.json")) {
        // Store version info for daily.json - critical for state consistency
        await storeDailyJsonVersionInfo(response);
      }
    } catch (error) {
      console.error(`Failed to refresh ${file}:`, error);
      throw error;
    }
  }

  return results;
};

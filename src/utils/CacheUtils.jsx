/**
 * Cache management utilities for PWA data refresh
 */

import { STORAGE_KEYS } from './Constants';

const DATA_FILES = [
  '/data/regions.json',
  '/data/birds.json'
];

/**
 * Check if service worker is active and ready
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export const getServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration;
  } catch (error) {
    console.error('Failed to get service worker registration:', error);
    return null;
  }
};

/**
 * Get version information from cached vs fresh data
 * Compares Last-Modified headers or ETags
 * @returns {Promise<{hasUpdate: boolean, cachedVersion?: string, serverVersion?: string}>}
 */
export const checkForUpdates = async () => {
  try {
    // Try to fetch regions.json with HEAD request to check version
    // This matches the file we use in loadGameData for version tracking
    const response = await fetch('/data/regions.json', {
      method: 'HEAD',
      cache: 'no-store'
    });

    const serverLastModified = response.headers.get('Last-Modified');
    const serverETag = response.headers.get('ETag');

    // Get cached version info from localStorage
    const cachedLastModified = localStorage.getItem(STORAGE_KEYS.CACHE_LAST_MODIFIED);
    const cachedETag = localStorage.getItem(STORAGE_KEYS.CACHE_ETAG);

    const hasUpdate =
      (serverLastModified && serverLastModified !== cachedLastModified) ||
      (serverETag && serverETag !== cachedETag);

    return {
      hasUpdate,
      serverVersion: serverLastModified || serverETag,
      cachedVersion: cachedLastModified || cachedETag
    };
  } catch (error) {
    console.warn('Failed to check for updates:', error);
    return { hasUpdate: false };
  }
};

/**
 * Store version information after successful data load
 * @param {Response} response - Fetch response from data file
 */
export const storeVersionInfo = async (response) => {
  try {
    const lastModified = response.headers.get('Last-Modified');
    const etag = response.headers.get('ETag');

    if (lastModified) {
      localStorage.setItem(STORAGE_KEYS.CACHE_LAST_MODIFIED, lastModified);
    }
    if (etag) {
      localStorage.setItem(STORAGE_KEYS.CACHE_ETAG, etag);
    }
  } catch (error) {
    console.warn('Failed to store version info:', error);
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
    await Promise.all(
      cacheNames.map(cacheName => caches.delete(cacheName))
    );

    return true;
  } catch (error) {
    console.error('Failed to clear service worker cache:', error);
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
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${file}: ${response.status}`);
      }

      const data = await response.json();

      // Store in appropriate result key
      if (file.includes('regions.json')) {
        results.regions = data;
      } else if (file.includes('birds.json')) {
        results.birds = data;
      }

      // Update version info from first successful fetch
      if (i === 0) {
        await storeVersionInfo(response);
      }
    } catch (error) {
      console.error(`Failed to refresh ${file}:`, error);
      throw error;
    }
  }

  return results;
};

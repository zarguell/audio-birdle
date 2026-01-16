/**
 * Version tracking utilities for cache management
 * Provides consistent patterns for storing and comparing version info
 */

import { STORAGE_KEYS } from "./Constants";
import { setStorage, getStorage } from "./StorageUtils";

/**
 * Get version info from fetch response headers
 * @param {Response} response - Fetch response
 * @returns {{lastModified: string|null, etag: string|null}}
 */
export const getVersionFromResponse = (response) => ({
  lastModified: response.headers?.get("Last-Modified") || null,
  etag: response.headers?.get("ETag") || null,
});

/**
 * Store version info to localStorage
 * @param {Object} version - Version info object
 * @param {string} lastModifiedKey - localStorage key for lastModified
 * @param {string} etagKey - localStorage key for etag
 */
export const storeVersion = (version, lastModifiedKey, etagKey) => {
  if (version.lastModified) {
    setStorage(lastModifiedKey, version.lastModified);
  }
  if (version.etag) {
    setStorage(etagKey, version.etag);
  }
};

/**
 * Get cached version from localStorage
 * @param {string} lastModifiedKey - localStorage key for lastModified
 * @param {string} etagKey - localStorage key for etag
 * @returns {{lastModified: string|null, etag: string|null}}
 */
export const getCachedVersion = (lastModifiedKey, etagKey) => ({
  lastModified: getStorage(lastModifiedKey, null),
  etag: getStorage(etagKey, null),
});

/**
 * Compare server and cached versions
 * @param {Object} serverVersion - Server version info
 * @param {Object} cachedVersion - Cached version info
 * @returns {boolean} - True if versions differ (update available)
 */
export const hasVersionChanged = (serverVersion, cachedVersion) =>
  (serverVersion.lastModified &&
    serverVersion.lastModified !== cachedVersion.lastModified) ||
  (serverVersion.etag && serverVersion.etag !== cachedVersion.etag);

/**
 * Check if a data file has been updated
 * @param {string} url - URL of the data file to check
 * @param {string} lastModifiedKey - localStorage key for lastModified
 * @param {string} etagKey - localStorage key for etag
 * @returns {Promise<{hasUpdate: boolean, serverVersion?: string, cachedVersion?: string}>}
 */
export const checkDataFileUpdate = async (url, lastModifiedKey, etagKey) => {
  try {
    const response = await fetch(url, { method: "HEAD", cache: "no-store" });
    const serverVersion = getVersionFromResponse(response);
    const cachedVersion = getCachedVersion(lastModifiedKey, etagKey);

    return {
      hasUpdate: hasVersionChanged(serverVersion, cachedVersion),
      serverVersion: serverVersion.lastModified || serverVersion.etag,
      cachedVersion: cachedVersion.lastModified || cachedVersion.etag,
    };
  } catch (error) {
    console.warn(`Failed to check ${url} for updates:`, error);
    return { hasUpdate: false };
  }
};

/**
 * Store version info for a specific data file
 * @param {Response} response - Fetch response
 * @param {string} lastModifiedKey - localStorage key for lastModified
 * @param {string} etagKey - localStorage key for etag
 */
export const storeDataFileVersion = (response, lastModifiedKey, etagKey) => {
  const version = getVersionFromResponse(response);
  storeVersion(version, lastModifiedKey, etagKey);
};

export default {
  getVersionFromResponse,
  storeVersion,
  getCachedVersion,
  hasVersionChanged,
  checkDataFileUpdate,
  storeDataFileVersion,
};

/**
 * LocalStorage utilities for game state persistence
 * Provides unified API with consistent error handling for all storage operations
 */

/**
 * Check if localStorage is accessible and working
 * @returns {boolean} True if localStorage is available
 */
export const isStorageAvailable = () => {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

/**
 * Retrieve and parse data from localStorage with error handling
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist or error occurs
 * @returns {*} Parsed data or default value
 */
export const getStorage = (key, defaultValue) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.warn(`Failed to get ${key}: Quota exceeded`);
    } else {
      console.warn(`Failed to get ${key}:`, error);
    }
    return defaultValue;
  }
};

/**
 * Store data in localStorage with error handling
 * @param {string} key - Storage key
 * @param {*} value - Value to store (will be JSON stringified)
 * @returns {boolean} True if storage succeeded, false otherwise
 */
export const setStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.warn(`Failed to set ${key}: Quota exceeded`);
    } else {
      console.warn(`Failed to set ${key}:`, error);
    }
    return false;
  }
};

/**
 * Remove data from localStorage with error handling
 * @param {string} key - Storage key to remove
 * @returns {boolean} True if removal succeeded, false otherwise
 */
export const removeStorage = (key) => {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to remove ${key}:`, error);
    return false;
  }
};

/**
 * Get all keys from localStorage (useful for debugging)
 * @returns {string[]} Array of all storage keys
 */
export const getStorageKeys = () => {
  try {
    return Object.keys(localStorage);
  } catch (error) {
    console.warn('Failed to get storage keys:', error);
    return [];
  }
};

/**
 * Clear all application data from localStorage
 * Uses app-specific key prefix to avoid clearing other domains' data
 * @param {string} [keyPrefix='audio-birdle-'] - Prefix to identify app keys
 * @returns {number} Number of keys cleared
 */
export const clearStorage = (keyPrefix = 'audio-birdle-') => {
  try {
    const keys = getStorageKeys();
    let cleared = 0;
    keys.forEach((key) => {
      if (key.startsWith(keyPrefix)) {
        localStorage.removeItem(key);
        cleared++;
      }
    });
    return cleared;
  } catch (error) {
    console.warn('Failed to clear storage:', error);
    return 0;
  }
};

// Legacy API - maintained for backward compatibility
/**
 * @deprecated Use getStorage instead
 * Retrieve and parse data from localStorage
 */
export const getStoredData = getStorage;

/**
 * @deprecated Use setStorage instead
 * Store data in localStorage
 */
export const setStoredData = setStorage;

/**
 * @deprecated Use removeStorage instead
 * Remove data from localStorage
 */
export const removeStoredData = removeStorage;

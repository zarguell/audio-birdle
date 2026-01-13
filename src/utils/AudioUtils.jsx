// Audio player utilities
import { STORAGE_KEYS } from "./Constants";

// Track dead audio URLs to avoid repeated requests
const deadAudioUrls = new Set();
const audioUrlValidationCache = new Map();

/**
 * Gets the audio source URL from various audioUrl data formats.
 * Handles backward compatibility for string, array of strings, and array of objects.
 *
 * @param {string|string[]|Object[]} audioUrlData - The audio URL data in various formats
 * @param {number} index - The index to use when audioUrlData is an array (default: 0)
 * @returns {string} The audio source URL
 */
export const getAudioSrc = (audioUrlData, index = 0) => {
  if (!audioUrlData) return "";
  // Backward compatibility for non-array format (single string)
  if (!Array.isArray(audioUrlData)) return audioUrlData;

  const audioItem = audioUrlData[index];
  if (!audioItem) return "";

  // New format: array of objects with url property
  if (typeof audioItem === "object" && audioItem.url) {
    return audioItem.url;
  }

  // Backward compatibility for array of strings
  return audioItem;
};

/**
 * Validate if an audio URL is reachable with a HEAD request
 * Caches results to avoid repeated validation
 * @param {string} url - Audio URL to validate
 * @returns {Promise<boolean>} - True if URL is reachable
 */
export const validateAudioUrl = async (url) => {
  if (!url) return false;

  // Check if we already know this URL is dead
  if (deadAudioUrls.has(url)) {
    return false;
  }

  // Check cache first
  if (audioUrlValidationCache.has(url)) {
    return audioUrlValidationCache.get(url);
  }

  try {
    const response = await fetch(url, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const isValid = response.ok;
    if (!isValid) {
      deadAudioUrls.add(url);
    }

    // Cache result for 1 hour
    audioUrlValidationCache.set(url, isValid);
    setTimeout(() => audioUrlValidationCache.delete(url), 60 * 60 * 1000);

    return isValid;
  } catch (error) {
    // Network errors, timeouts, or CORS issues = treat as dead
    console.warn(`Audio URL validation failed for ${url}:`, error.message);
    deadAudioUrls.add(url);
    return false;
  }
};

/**
 * Get the first working audio URL from an array
 * Falls back through array until finding a valid URL
 * @param {string[]|Object[]} audioUrlData - Array of audio URLs or objects
 * @returns {Promise<{url: string, index: number} | null>} - First valid URL and its index, or null
 */
export const getFirstWorkingAudioUrl = async (audioUrlData) => {
  if (!Array.isArray(audioUrlData)) {
    return { url: audioUrlData, index: 0 };
  }

  for (let i = 0; i < audioUrlData.length; i++) {
    const url = getAudioSrc(audioUrlData, i);
    if (url && (await validateAudioUrl(url))) {
      return { url, index: i };
    }
  }

  return null;
};

/**
 * Load cached dead audio URLs from localStorage
 * Persists across sessions
 */
export const loadDeadAudioUrlsCache = () => {
  try {
    const cached = localStorage.getItem(STORAGE_KEYS.DEAD_AUDIO_URLS || "");
    if (cached) {
      const urls = JSON.parse(cached);
      urls.forEach((url) => deadAudioUrls.add(url));
    }
  } catch (error) {
    console.warn("Failed to load dead audio URLs cache:", error);
  }
};

/**
 * Save dead audio URLs to localStorage for persistence
 */
export const saveDeadAudioUrlsCache = () => {
  try {
    const urls = Array.from(deadAudioUrls);
    localStorage.setItem(
      STORAGE_KEYS.DEAD_AUDIO_URLS || "",
      JSON.stringify(urls),
    );
  } catch (error) {
    console.warn("Failed to save dead audio URLs cache:", error);
  }
};

export const createAudioControls = (audioRef) => {
  const playAudio = async () => {
    if (!audioRef.current) return false;

    try {
      await audioRef.current.play();
      return true;
    } catch (error) {
      console.error("Audio play failed:", error);
      return false;
    }
  };

  const pauseAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
  };

  const stopAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
  };

  return {
    playAudio,
    pauseAudio,
    stopAudio,
  };
};

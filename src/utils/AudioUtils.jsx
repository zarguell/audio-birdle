// Audio player utilities
import { STORAGE_KEYS } from "./Constants";

// Track dead audio URLs to avoid repeated failed playback attempts
// Only populated when actual audio playback fails (lazy validation)
const deadAudioUrls = new Set();

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
 * Check if an audio URL is known to be dead (failed playback previously)
 * @param {string} url - Audio URL to check
 * @returns {boolean} - True if URL is known dead
 */
export const isAudioUrlDead = (url) => {
  return deadAudioUrls.has(url);
};

/**
 * Mark an audio URL as dead after actual playback failure
 * Called from audio element's onError handler
 * @param {string} url - Audio URL that failed to play
 */
export const markAudioUrlDead = (url) => {
  if (url) {
    deadAudioUrls.add(url);
    saveDeadAudioUrlsCache();
  }
};

/**
 * Load cached dead audio URLs from localStorage
 * Persists across sessions - only contains URLs that actually failed playback
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

/**
 * Clear the dead audio URLs cache
 * Useful when birds.json is updated with new URLs
 */
export const clearDeadAudioUrlsCache = () => {
  deadAudioUrls.clear();
  try {
    localStorage.removeItem(STORAGE_KEYS.DEAD_AUDIO_URLS || "");
  } catch (error) {
    console.warn("Failed to clear dead audio URLs cache:", error);
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

// Daily bird utilities for hash-based bird selection
import { hashString } from "./HashUtils";
import { storeDailyJsonVersionInfo } from "./CacheUtils";

// This salt should be kept secret in a real application
// In production, this could come from an API endpoint or be embedded differently
const SECRET_SALT = "birdle-salt-2025";

/**
 * Hash a bird ID with the secret salt
 * @param {string} birdId - The bird's unique identifier
 * @returns {string} - 8-character lowercase hex hash
 */
export const hashBirdId = (birdId) => {
  const combined = `${birdId}-${SECRET_SALT}`;
  return hashString(combined); // Already returns 8-char hex string
};

/**
 * Find the bird that matches the given answer hash
 * @param {Array} birds - Array of bird objects
 * @param {string} answerHash - The hash to match against
 * @returns {Object|null} - The matching bird or null if not found
 */
export const findBirdByHash = (birds, answerHash) => {
  if (!birds || !answerHash) return null;

  for (const bird of birds) {
    const birdHash = hashBirdId(bird.id);
    // console.log(`Checking bird: ${bird.name} (${bird.id}) -> Hash: ${birdHash}, Against: ${answerHash}`);
    if (birdHash === answerHash.toLowerCase()) {
      return bird;
    }
  }
  return null;
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

/**
 * Load daily bird data from daily.json with retry logic
 * Tracks version info for cache consistency validation
 * @returns {Promise<Array>} - Promise resolving to daily bird data array
 */
export const loadDailyBirdData = async () => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch("/data/daily.json");
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      // Validate that data is an array
      if (!Array.isArray(data)) {
        console.error("Daily data is not an array:", data);
        throw new Error("Daily data must be an array of entries");
      }

      // Store version info for cache consistency tracking
      // This allows us to detect when daily.json has been updated
      await storeDailyJsonVersionInfo(response);

      return data;
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        const delayMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(
          `Failed to load daily.json (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delayMs}ms:`,
          error.message,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error(
          `Failed to load daily bird data after ${MAX_RETRIES} attempts:`,
          error,
        );
        throw error;
      }
    }
  }
};

/**
 * Get today's bird using the daily.json approach
 * @param {string} region - The selected region
 * @param {Array} birds - Array of birds for the region
 * @param {string} date - Current date string (YYYY-MM-DD)
 * @returns {Promise<Object|null>} - Promise resolving to today's bird or null
 */
export const getTodaysBirdFromDaily = async (region, birds, date) => {
  try {
    const dailyData = await loadDailyBirdData();

    // Additional safety check
    if (!Array.isArray(dailyData)) {
      console.error("Daily data is not an array, cannot proceed");
      return null;
    }

    // Find the entry for today's date and region
    const todaysEntry = dailyData.find(
      (entry) => entry.date === date && entry.region === region,
    );

    if (!todaysEntry) {
      console.warn(`No daily bird entry found for ${region} on ${date}`);
      return null;
    }

    // Find the bird that matches the hash
    const bird = findBirdByHash(birds, todaysEntry.answerHash);
    if (!bird) {
      console.warn(
        `No bird found matching hash ${todaysEntry.answerHash} for ${region} on ${date}`,
      );
      return null;
    } else {
      // console.log(`Today's bird for ${region} on ${date}: ${bird.name} (${bird.id})`);
    }

    return bird;
  } catch (error) {
    console.error("Error getting today's bird from daily data:", error);
    return null;
  }
};

/**
 * Generate a daily.json entry for a specific bird (utility for content creators)
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} region - Region identifier
 * @param {string} birdId - Bird ID to use as answer
 * @returns {Object} - Daily.json entry object
 */
export const generateDailyEntry = (date, region, birdId) => {
  return {
    date,
    region,
    answerHash: hashBirdId(birdId),
  };
};

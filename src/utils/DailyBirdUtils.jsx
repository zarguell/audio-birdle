// Daily bird utilities for hash-based bird selection
import { hashString } from "./HashUtils";
import { storeDailyJsonVersionInfo } from "./CacheUtils";
import { fetchWithRetry } from "./RetryUtils";

// This salt should be kept secret in a real application
// In production, this could come from an API endpoint or be embedded differently
const SECRET_SALT = "birdle-salt-2025";

// Module-level cache for parsed daily.json — avoids refetching on every lookup
let dailyBirdDataCache = null;

/**
 * Invalidate the cached daily.json data.
 * Call after any refresh so the next lookup fetches fresh data from the server.
 */
export const invalidateDailyBirdCache = () => {
  dailyBirdDataCache = null;
};

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

/**
 * Load daily bird data from daily.json with retry logic
 * Tracks version info for cache consistency validation.
 * Results are cached module-level; use invalidateDailyBirdCache() to bust.
 * @returns {Promise<Array>} - Promise resolving to daily bird data array
 */
export const loadDailyBirdData = async () => {
  if (dailyBirdDataCache) {
    return dailyBirdDataCache;
  }

  // Cache-bust: guarantees the request bypasses the browser HTTP cache and
  // CDN edge caches, so a stale cached daily.json (e.g. from a previous day)
  // can never break the daily challenge lookup after a refresh.
  const cacheBustedUrl = `/data/daily.json?t=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await fetchWithRetry(
    cacheBustedUrl,
    {},
    { maxRetries: 3, baseDelay: 500 },
  );
  const data = await response.json();

  // Validate that data is an array
  if (!Array.isArray(data)) {
    console.error("Daily data is not an array:", data);
    throw new Error("Daily data must be an array of entries");
  }

  // Store version info for cache consistency tracking
  // This allows us to detect when daily.json has been updated
  await storeDailyJsonVersionInfo(response);

  dailyBirdDataCache = data;
  return data;
};

/**
 * Get today's bird using the daily.json approach.
 * Picks the LATEST entry for the region with entry.date <= date (YYYY-MM-DD
 * strings compare lexicographically), so a UTC-stamped daily.json still
 * matches a local 'today' after the daily publish time.
 * @param {string} region - The selected region
 * @param {Array} birds - Array of birds for the region
 * @param {string} date - Current date string (YYYY-MM-DD)
 * @returns {Promise<{success: boolean, bird?: Object, error?: string}>} -
 *   { success: true, bird } on success,
 *   { success: false, error: "network" } on fetch failure,
 *   { success: false, error: "not_found" } when no matching entry/bird exists.
 */
export const getTodaysBirdFromDaily = async (region, birds, date) => {
  let dailyData;
  try {
    dailyData = await loadDailyBirdData();
  } catch (error) {
    console.error("Error loading daily data:", error);
    return { success: false, error: "network" };
  }

  // Find the latest entry for today's region with date <= requested date
  const regionEntries = dailyData.filter(
    (entry) => entry.region === region && entry.date <= date,
  );
  regionEntries.sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
  const todaysEntry = regionEntries[0];

  if (!todaysEntry) {
    console.warn(
      `No daily bird entry found for ${region} on or before ${date}`,
    );
    return { success: false, error: "not_found" };
  }

  // Find the bird that matches the hash
  const bird = findBirdByHash(birds, todaysEntry.answerHash);
  if (!bird) {
    console.warn(
      `No bird found matching hash ${todaysEntry.answerHash} for ${region} on ${date}`,
    );
    return { success: false, error: "not_found" };
  }

  return { success: true, bird };
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

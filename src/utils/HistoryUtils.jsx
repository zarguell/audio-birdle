/**
 * HistoryUtils - Challenge archive utilities
 *
 * history.json contains one entry per past daily challenge per region:
 * { "us": [{ date, id, name, subregion }, ...] }
 *
 * IMPORTANT: the generator writes entries ahead of time (today and the
 * next several days are already present in the shipped file). Anything
 * dated today or later is a future answer — getPastEntries() strictly
 * filters to dates BEFORE today so the archive can never spoil an
 * upcoming challenge.
 */

import { fetchWithRetry } from "./RetryUtils";
import { getAudioSrc } from "./AudioUtils";

// Module-level cache for parsed history.json — mirrors DailyBirdUtils
let historyCache = null;

/**
 * Invalidate the cached history.json data.
 */
export const invalidateHistoryCache = () => {
  historyCache = null;
};

/**
 * Load and cache history.json.
 * Results are cached module-level; use invalidateHistoryCache() to bust.
 *
 * @returns {Promise<Object>} Map of region id -> array of history entries
 */
export const loadHistoryData = async () => {
  if (historyCache) {
    return historyCache;
  }
  const response = await fetchWithRetry("/data/history.json");
  const data = await response.json();
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid history data format");
  }
  historyCache = data;
  return historyCache;
};

/**
 * Get past challenge entries for a region, newest first.
 *
 * Filters out today's and future entries (spoiler guard) and validates
 * the ISO date shape so malformed entries cannot leak through.
 *
 * @param {Object} history - Parsed history.json ({ region: [entries] })
 * @param {string} regionId - Region id (e.g. "us")
 * @param {string} todayIso - Today's date as YYYY-MM-DD
 * @returns {Array} Entries sorted by date descending
 */
export const getPastEntries = (history, regionId, todayIso) => {
  if (!history || !regionId || !todayIso) {
    return [];
  }
  const entries = history[regionId];
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry) => {
      if (!entry || typeof entry.date !== "string") {
        return false;
      }
      // Strictly earlier than today: today's answer and pre-generated
      // future answers must never appear in the archive.
      return entry.date < todayIso;
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
};

/**
 * Enrich history entries with their bird records (for listen-again).
 *
 * Looks each entry's id up in the region's bird pool (the caller passes
 * the pool that already accounts for virtual regions, e.g. the
 * us-lower48 list built by LoadGameData). Entries whose bird is missing
 * from the pool keep a null bird and simply render without playback.
 *
 * @param {Array} entries - History entries (from getPastEntries)
 * @param {Array} regionBirds - Bird records for the region
 * @returns {Array} [{ ...entry, bird }] with bird attached (or null)
 */
export const enrichHistoryEntries = (entries, regionBirds) => {
  if (!Array.isArray(entries)) {
    return [];
  }
  const birdsById = new Map(
    (Array.isArray(regionBirds) ? regionBirds : []).map((bird) => [
      bird.id,
      bird,
    ]),
  );

  return entries.map((entry) => ({
    ...entry,
    bird: birdsById.get(entry.id) || null,
  }));
};

/**
 * Pick a random clip URL for an enriched history entry.
 * A different clip on each listen keeps the archive replayable.
 *
 * @param {Object} enrichedEntry - Entry with bird attached
 * @returns {string} Playable https URL, or "" when unavailable
 */
export const pickHistoryClipUrl = (enrichedEntry) => {
  const bird = enrichedEntry?.bird;
  if (!bird || !Array.isArray(bird.audioUrl) || bird.audioUrl.length === 0) {
    return "";
  }
  const index = Math.floor(Math.random() * bird.audioUrl.length);
  return getAudioSrc(bird.audioUrl, index);
};

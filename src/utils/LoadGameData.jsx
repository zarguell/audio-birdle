import { storeVersionInfo, storeBirdsJsonVersionInfo } from "./CacheUtils";
import { fetchWithRetry } from "./RetryUtils";

/**
 * Validate that a value is a full https URL.
 * Rejects non-strings, empty strings, relative URLs, and every non-https
 * protocol (e.g. javascript:, data:) — these are the URLs that flow into
 * <audio src>, <img src> and <a href>.
 * @param {*} url - URL to validate
 * @returns {boolean} True if url is a valid https URL
 */
export const isHttpsUrl = (url) => {
  if (typeof url !== "string" || url.length === 0) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Sanitize a single bird record: keep only https audio/image URLs and drop
 * non-https learnMoreUrl values (defense against javascript: URLs flowing
 * into <audio src>/<img src>/<a href>). Mutates and returns the bird record.
 * @param {Object} bird - Bird record
 * @returns {Object} The sanitized bird record
 */
const sanitizeBird = (bird) => {
  if (!bird || typeof bird !== "object") return bird;

  if (Array.isArray(bird.audioUrl)) {
    bird.audioUrl = bird.audioUrl.filter((item) => {
      const url = typeof item === "string" ? item : item && item.url;
      return isHttpsUrl(url);
    });
  } else if (typeof bird.audioUrl === "string" && !isHttpsUrl(bird.audioUrl)) {
    delete bird.audioUrl;
  }

  if (typeof bird.learnMoreUrl === "string" && !isHttpsUrl(bird.learnMoreUrl)) {
    delete bird.learnMoreUrl;
  }

  if (Array.isArray(bird.images)) {
    bird.images = bird.images.filter(
      (img) => img && typeof img === "object" && isHttpsUrl(img.url),
    );
  } else if (bird.images && !isHttpsUrl(bird.images.url ?? bird.images)) {
    delete bird.images;
  }

  return bird;
};

/**
 * Sanitize every bird in the birds map (mutates in place).
 * @param {Object} birds - Map of region id -> bird array
 * @returns {Object} The sanitized birds map
 */
const sanitizeBirds = (birds) => {
  if (!birds || typeof birds !== "object") return birds;
  for (const regionId of Object.keys(birds)) {
    const regionBirds = birds[regionId];
    if (!Array.isArray(regionBirds)) continue;
    regionBirds.forEach(sanitizeBird);
  }
  return birds;
};

// Module-level cache for parsed daily-subregion-birds.json
let subregionBirdsCache = null;

/**
 * Invalidate the cached daily-subregion-birds.json data.
 */
export const invalidateSubregionBirdsCache = () => {
  subregionBirdsCache = null;
};

/**
 * Load daily-subregion-birds.json with retry logic, cached module-level.
 * @returns {Promise<Object>} Map of region -> subregion -> bird id list
 */
const loadSubregionBirds = async () => {
  if (subregionBirdsCache) {
    return subregionBirdsCache;
  }
  const response = await fetchWithRetry("/data/daily-subregion-birds.json");
  const data = await response.json();
  subregionBirdsCache = data;
  return data;
};

/**
 * Build the bird list for a virtual region that excludes subregions
 * (e.g. us-lower48 excludes Alaska/Hawaii): the parent region's birds minus
 * the ids that appear in any excluded subregion's list.
 * Falls back to the parent list (with a log) when the subregion data cannot
 * be fetched or the derived list would be empty.
 * @param {Object} region - Virtual region record (parentRegion + excludedSubregions)
 * @param {Object} birds - Map of region id -> bird array (already sanitized)
 * @returns {Promise<Array>} The derived bird list
 */
const buildExcludedRegionBirds = async (region, birds) => {
  const parentBirds = birds[region.parentRegion] || [];

  let subregionBirds;
  try {
    subregionBirds = await loadSubregionBirds();
  } catch (error) {
    console.error(
      `Failed to load subregion bird data for ${region.id}, falling back to parent list:`,
      error,
    );
    return parentBirds;
  }

  const excludedIds = new Set();
  for (const subregion of region.excludedSubregions || []) {
    const subregionList = subregionBirds?.[region.parentRegion]?.[subregion];
    if (Array.isArray(subregionList)) {
      subregionList.forEach((bird) => {
        if (bird && bird.id) excludedIds.add(bird.id);
      });
    }
  }

  const derived = parentBirds.filter((bird) => !excludedIds.has(bird.id));
  if (derived.length === 0) {
    console.warn(
      `Exclusion for ${region.id} produced an empty list, falling back to parent list`,
    );
    return parentBirds;
  }
  return derived;
};

export async function loadGameData(forceRefresh = false) {
  if (forceRefresh) {
    invalidateSubregionBirdsCache();
  }

  const cacheOptions = forceRefresh
    ? {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
      }
    : {};

  const regionsRes = await fetchWithRetry("/data/regions.json", cacheOptions);
  const regions = await regionsRes.json();

  const birdsRes = await fetchWithRetry("/data/birds.json", cacheOptions);
  let birds = await birdsRes.json();

  // Sanitize data-file URLs before they reach <audio src>/<img src>/<a href>
  birds = sanitizeBirds(birds);

  // Handle virtual regions - fallback to parent region's bird data
  for (const region of regions) {
    if (
      region.parentRegion &&
      !birds[region.id] &&
      Array.isArray(birds[region.parentRegion])
    ) {
      if (region.excludedSubregions && region.excludedSubregions.length > 0) {
        // Exclude birds that live only in the excluded subregions
        birds[region.id] = await buildExcludedRegionBirds(region, birds);
      } else {
        birds[region.id] = birds[region.parentRegion];
      }
    }
  }

  // Store version info if not forcing refresh
  if (!forceRefresh) {
    if (regionsRes.ok) {
      await storeVersionInfo(regionsRes);
    }
    if (birdsRes.ok) {
      await storeBirdsJsonVersionInfo(birdsRes);
    }
  }

  return { regions, birds };
}

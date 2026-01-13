import { storeVersionInfo, storeBirdsJsonVersionInfo } from "./CacheUtils";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

/**
 * Retry a fetch with exponential backoff
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} attempt - Current attempt number
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, attempt = 1) {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${response.statusText} for ${url}`,
      );
    }
    return response;
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const delayMs = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.warn(
        `Fetch failed for ${url} (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delayMs}ms:`,
        error.message,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return fetchWithRetry(url, options, attempt + 1);
    }
    console.error(
      `Failed to fetch ${url} after ${MAX_RETRIES} attempts:`,
      error,
    );
    throw error;
  }
}

export async function loadGameData(forceRefresh = false) {
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

  // Handle virtual regions - fallback to parent region's bird data
  regions.forEach((region) => {
    if (region.parentRegion && !birds[region.id]) {
      birds[region.id] = birds[region.parentRegion];
    }
  });

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

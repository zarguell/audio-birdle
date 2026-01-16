import { storeVersionInfo, storeBirdsJsonVersionInfo } from "./CacheUtils";
import { fetchWithRetry } from "./RetryUtils";

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

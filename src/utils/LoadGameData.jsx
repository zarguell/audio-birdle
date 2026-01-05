import { storeVersionInfo } from "./CacheUtils";

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

  const regionsRes = await fetch("/data/regions.json", cacheOptions);
  const regions = await regionsRes.json();

  const birdsRes = await fetch("/data/birds.json", cacheOptions);
  let birds = await birdsRes.json();

  // Handle virtual regions - fallback to parent region's bird data
  regions.forEach(region => {
    if (region.parentRegion && !birds[region.id]) {
      birds[region.id] = birds[region.parentRegion];
    }
  });

  // Store version info if not forcing refresh
  if (!forceRefresh && regionsRes.ok) {
    await storeVersionInfo(regionsRes);
  }

  return { regions, birds };
}

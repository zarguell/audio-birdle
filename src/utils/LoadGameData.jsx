import { storeVersionInfo } from './CacheUtils';

export async function loadGameData(forceRefresh = false) {
  const cacheOptions = forceRefresh ? {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  } : {};

  const regionsRes = await fetch('/data/regions.json', cacheOptions);
  const regions = await regionsRes.json();

  const birdsRes = await fetch('/data/birds.json', cacheOptions);
  const birds = await birdsRes.json();

  // Store version info if not forcing refresh
  if (!forceRefresh && regionsRes.ok) {
    await storeVersionInfo(regionsRes);
  }

  return { regions, birds };
}

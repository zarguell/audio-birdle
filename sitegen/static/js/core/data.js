/**
 * Data loading with a content-hash manifest.
 *
 * Every JSON file is requested through the manifest's SHA-256. A stale CDN or
 * browser cache can therefore never pair yesterday's daily answer with today's
 * bird list: if a hash does not match, the manifest is refreshed and the file
 * is fetched again with a cache-busting URL.
 */
import { DATA_FILES } from "./constants.js";

const parsedCache = new Map();
const birdListCache = new Map();
let manifestPromise = null;

export class DataVersionError extends Error {}

const delay = (milliseconds) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });

export const isHttpsUrl = (value) => {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

const sanitizeBird = (bird) => {
  if (!bird || typeof bird !== "object") {
    return bird;
  }
  if (Array.isArray(bird.audioUrl)) {
    bird.audioUrl = bird.audioUrl.filter((item) => {
      const url = typeof item === "string" ? item : item?.url;
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
      (image) => image && typeof image === "object" && isHttpsUrl(image.url),
    );
  } else if (bird.images && !isHttpsUrl(bird.images.url ?? bird.images)) {
    delete bird.images;
  }
  return bird;
};

const sanitizeBirds = (birds) => {
  if (!birds || typeof birds !== "object") {
    return birds;
  }
  for (const regionBirds of Object.values(birds)) {
    if (Array.isArray(regionBirds)) {
      regionBirds.forEach(sanitizeBird);
    }
  }
  return birds;
};

export async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === "undefined") {
    return null;
  }
  const encoder = new TextEncoder();
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    encoder.encode(text),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchText(
  url,
  { retries = 3, baseDelay = 350, cache = "default" } = {},
) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {
        cache,
        signal: controller.signal,
        headers:
          cache === "no-store"
            ? { "Cache-Control": "no-cache", Pragma: "no-cache" }
            : undefined,
      });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status}): ${url}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await delay(baseDelay * 2 ** attempt);
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }
  throw lastError || new Error(`Request failed: ${url}`);
}

export function loadManifest({ force = false } = {}) {
  if (force) {
    manifestPromise = null;
  }
  if (manifestPromise) {
    return manifestPromise;
  }

  manifestPromise = (async () => {
    try {
      const url = `/data/manifest.json?t=${Date.now().toString(36)}`;
      const text = await fetchText(url, { cache: "no-store", retries: 1 });
      const manifest = JSON.parse(text);
      if (
        !manifest ||
        manifest.schemaVersion !== 1 ||
        !manifest.files ||
        typeof manifest.files !== "object"
      ) {
        throw new Error("Invalid data manifest shape");
      }
      return manifest;
    } catch (error) {
      console.warn("Data manifest unavailable; falling back to stable URLs.", error);
      return null;
    }
  })();

  return manifestPromise;
}

async function fetchJsonWithManifest(filename) {
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const manifest = await loadManifest({ force: attempt > 0 });
    const entry = manifest?.files?.[filename];
    const path = entry?.path || `/data/${filename}`;
    const url = new URL(path, window.location.origin);
    if (entry?.sha256) {
      url.searchParams.set("v", entry.sha256.slice(0, 16));
    }
    // Without a manifest entry the URL is not content-addressed, so force a
    // fresh request. /data/* is served immutable; an unversioned fallback
    // must never be allowed to stick in a browser or edge cache.
    if (attempt > 0 || !entry) {
      url.searchParams.set("t", Date.now().toString(36));
    }

    try {
      const text = await fetchText(url.toString(), {
        cache: attempt > 0 || !entry ? "no-store" : "default",
        retries: attempt > 0 ? 1 : 3,
      });

      if (entry?.sha256) {
        const digest = await sha256Hex(text);
        if (digest && digest !== entry.sha256) {
          lastError = new DataVersionError(
            `${filename} did not match the data manifest`,
          );
          continue;
        }
      }

      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      if (error instanceof DataVersionError) {
        continue;
      }
      if (attempt > 0) {
        throw error;
      }
    }
  }

  throw lastError || new Error(`Could not load ${filename}`);
}

export async function fetchData(filename, { force = false } = {}) {
  if (!force && parsedCache.has(filename)) {
    return parsedCache.get(filename);
  }
  const data = await fetchJsonWithManifest(filename);
  parsedCache.set(filename, data);
  return data;
}

export async function loadRegions({ force = false } = {}) {
  const regions = await fetchData(DATA_FILES.regions, { force });
  if (!Array.isArray(regions)) {
    throw new Error("regions.json must be an array");
  }
  return regions;
}

export async function loadBirds({ force = false } = {}) {
  const birds = await fetchData(DATA_FILES.birds, { force });
  if (!birds || typeof birds !== "object" || Array.isArray(birds)) {
    throw new Error("birds.json must be an object");
  }
  return sanitizeBirds(birds);
}

export async function loadDaily({ force = false } = {}) {
  const daily = await fetchData(DATA_FILES.daily, { force });
  if (!Array.isArray(daily)) {
    throw new Error("daily.json must be an array");
  }
  return daily;
}

export async function loadHistory({ force = false } = {}) {
  const history = await fetchData(DATA_FILES.history, { force });
  if (!history || typeof history !== "object" || Array.isArray(history)) {
    throw new Error("history.json must be an object");
  }
  return history;
}

export function getBirdList(regionId, regions, birds) {
  if (birdListCache.has(regionId)) {
    return birdListCache.get(regionId);
  }

  if (Array.isArray(birds[regionId])) {
    birdListCache.set(regionId, birds[regionId]);
    return birds[regionId];
  }

  // Virtual regions (for example us-lower48) use the parent region's pool.
  // The daily generator filters *subregion selection* separately; subtracting
  // every species observed in an excluded subregion removed birds that also
  // live elsewhere (for example Northern Mockingbird) and could make the
  // daily answer impossible to find.
  const region = regions.find((entry) => entry.id === regionId);
  const parentBirds = region?.parentRegion ? birds[region.parentRegion] : null;
  const result = Array.isArray(parentBirds) ? parentBirds : [];
  birdListCache.set(regionId, result);
  return result;
}


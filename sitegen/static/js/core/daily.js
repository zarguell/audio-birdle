import { loadDaily } from "./data.js";
import { getDailyBirdFallback } from "./answers.js";
import { hashString } from "./hash.js";

const SECRET_SALT = "birdle-salt-2025";

export const hashBirdId = (birdId) => hashString(`${birdId}-${SECRET_SALT}`);

export function findBirdByHash(regionBirds, answerHash) {
  if (!Array.isArray(regionBirds) || !answerHash) {
    return null;
  }
  const normalizedHash = answerHash.toLowerCase();
  return (
    regionBirds.find((bird) => hashBirdId(bird.id) === normalizedHash) || null
  );
}

export function pickDailyEntry(entries, region, date) {
  const candidates = entries
    .filter((entry) => entry.region === region && entry.date <= date)
    .sort((left, right) => (left.date < right.date ? 1 : left.date > right.date ? -1 : 0));
  return candidates[0] || null;
}

export async function getTodaysBird(region, regionBirds, date) {
  try {
    const entries = await loadDaily();
    const entry = pickDailyEntry(entries, region, date);
    if (entry) {
      const bird = findBirdByHash(regionBirds, entry.answerHash);
      if (bird) {
        return {
          bird,
          entry,
          usedFallback: false,
          message: null,
        };
      }
    }

    const fallback = getDailyBirdFallback(region, regionBirds, date);
    if (fallback) {
      return {
        bird: fallback,
        entry: null,
        usedFallback: true,
        message:
          "Daily data is out of sync — using a hash-based bird so you can still play.",
      };
    }

    return {
      bird: null,
      entry: null,
      usedFallback: false,
      message: "Could not load a bird for this region.",
    };
  } catch (error) {
    console.error("Failed to load daily challenge:", error);
    const fallback = getDailyBirdFallback(region, regionBirds, date);
    if (fallback) {
      return {
        bird: fallback,
        entry: null,
        usedFallback: true,
        message:
          "Offline or data unavailable — using a hash-based bird for this session.",
      };
    }
    return {
      bird: null,
      entry: null,
      usedFallback: false,
      message: "Failed to load the daily challenge. Check your connection.",
    };
  }
}

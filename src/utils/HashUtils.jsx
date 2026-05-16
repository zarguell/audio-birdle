// Hash and randomization utilities
//
// Canonical DJB2 hash algorithm - must match Python implementation exactly
// Used for daily bird selection consistency across backend and frontend
// Algorithm: hash = ((hash << 5) - hash) + char_code
// Output: 32-bit unsigned integer formatted as 8-character lowercase hex string

export const hashString = (str) => {
  let hash = 0;
  if (str.length === 0) return "00000000";

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash >>> 0; // Ensure 32-bit unsigned
  }

  // Convert to 8-character lowercase hex (zero-padded)
  return hash.toString(16).padStart(8, '0');
};

export const createSeededRandom = (seed) => {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state % 2147483647) / 2147483647;
  };
};

export const deterministicShuffle = (array, seed) => {
  const shuffled = [...array];
  const random = createSeededRandom(seed);
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export const randomShuffle = (array) => deterministicShuffle(array, Date.now());

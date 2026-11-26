/**
 * Canonical DJB2 hash used by both the Python pipeline and the browser.
 * Output is exactly eight lowercase hex characters.
 */
export function hashString(value) {
  let hash = 0;
  if (value.length === 0) {
    return "00000000";
  }
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash >>>= 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function createSeededRandom(seed) {
  // Callers pass either a number or the 8-character hex string from
  // hashString(). `"1a2b3c4d" >>> 0` is 0, which would make every shuffle
  // identical, so parse hex strings explicitly.
  const numericSeed =
    typeof seed === "string" ? Number.parseInt(seed, 16) : Number(seed);
  let state = (Number.isFinite(numericSeed) ? numericSeed : 0) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state % 2147483647) / 2147483647;
  };
}

export function deterministicShuffle(array, seed) {
  const shuffled = [...array];
  const random = createSeededRandom(seed);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function randomShuffle(array) {
  const shuffled = [...array];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

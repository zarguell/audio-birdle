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

export const shuffleArray = (array, seed) => {
  const shuffled = [...array];
  let currentIndex = shuffled.length;
  let randomIndex;

  while (currentIndex !== 0) {
    randomIndex = Math.floor((seed % currentIndex));
    currentIndex--;
    [shuffled[currentIndex], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[currentIndex]];
    seed = Math.floor(seed / 2);
  }

  return shuffled;
};

// Pure date helpers for result streaks. Kept free of D1 and Discord so Node
// tests can exercise every edge without a Worker runtime.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Return the ISO date before `date` (UTC arithmetic), or null for bad input.
 * @param {string} date
 * @returns {string | null}
 */
export function previousDate(date) {
  if (typeof date !== "string" || !DATE_PATTERN.test(date)) return null;

  const [year, month, day] = date.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const value = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(value.getTime())) return null;
  value.setUTCDate(value.getUTCDate() - 1);

  return value.toISOString().slice(0, 10);
}

/**
 * Count consecutive ISO dates ending exactly at `endDate`.
 * Duplicate dates count once; a gap or a missing `endDate` stops the run.
 *
 * @param {string[]} dates
 * @param {string} endDate
 * @returns {number}
 */
export function computeStreak(dates, endDate) {
  if (!Array.isArray(dates) || typeof endDate !== "string" || !DATE_PATTERN.test(endDate)) {
    return 0;
  }

  const present = new Set(
    dates.filter((date) => typeof date === "string" && DATE_PATTERN.test(date)),
  );

  let streak = 0;
  let cursor = endDate;
  while (cursor !== null && present.has(cursor)) {
    streak += 1;
    cursor = previousDate(cursor);
  }

  return streak;
}

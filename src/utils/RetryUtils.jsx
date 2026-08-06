/**
 * Retry utilities for network operations with exponential backoff
 */

const DEFAULT_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
};

// Hard cap on any single backoff delay (30s) to bound worst-case wait time
export const MAX_BACKOFF_DELAY_MS = 30000;

/**
 * Compute the backoff delay for a given attempt with jitter.
 * Exponential base (baseDelay * 2^(attempt-1)) scaled by a random factor in
 * [0.5, 1.5], then capped at MAX_BACKOFF_DELAY_MS.
 * @param {number} baseDelay - Base delay in ms
 * @param {number} attempt - Failed attempt number (1-based)
 * @returns {number} Delay in ms
 */
const getBackoffDelayMs = (baseDelay, attempt) => {
  const exponential = baseDelay * Math.pow(2, attempt - 1);
  const jitterFactor = 0.5 + Math.random();
  return Math.min(
    Math.round(exponential * jitterFactor),
    MAX_BACKOFF_DELAY_MS,
  );
};

/**
 * Retry a fetch with exponential backoff
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {object} config - Retry configuration
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(
  url,
  options = {},
  config = DEFAULT_CONFIG
) {
  const { maxRetries, baseDelay } = { ...DEFAULT_CONFIG, ...config };

  return retryWithBackoff(
    async () => {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} for ${url}`
        );
      }
      return response;
    },
    { maxRetries, baseDelay, context: url }
  );
}

/**
 * Generic retry wrapper with exponential backoff for any async operation
 * @param {Function} operation - Async function to retry
 * @param {object} config - Retry configuration
 * @returns {Promise<any>} - Result of the operation
 */
export async function retryWithBackoff(
  operation,
  config = DEFAULT_CONFIG
) {
  const { maxRetries, baseDelay, context = "operation" } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt < maxRetries) {
        const delayMs = getBackoffDelayMs(baseDelay, attempt);
        console.warn(
          `${context} failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms:`,
          error.message
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error(
          `${context} failed after ${maxRetries} attempts:`,
          error
        );
        throw error;
      }
    }
  }
}

/**
 * Retry utilities for network operations with exponential backoff
 */

const DEFAULT_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
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
  config = DEFAULT_CONFIG,
) {
  const { maxRetries, baseDelay } = { ...DEFAULT_CONFIG, ...config };

  return retryWithBackoff(
    async () => {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} for ${url}`,
        );
      }
      return response;
    },
    { maxRetries, baseDelay, context: url },
  );
}

/**
 * Generic retry wrapper with exponential backoff for any async operation
 * @param {Function} operation - Async function to retry
 * @param {object} config - Retry configuration
 * @returns {Promise<any>} - Result of the operation
 */
export async function retryWithBackoff(operation, config = DEFAULT_CONFIG) {
  const {
    maxRetries,
    baseDelay,
    context = "operation",
  } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt < maxRetries) {
        const delayMs = baseDelay * Math.pow(2, attempt - 1);
        console.warn(
          `${context} failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms:`,
          error.message,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error(`${context} failed after ${maxRetries} attempts:`, error);
        throw error;
      }
    }
  }
}

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry, retryWithBackoff } from "@/utils/RetryUtils";

describe("RetryUtils", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchWithRetry", () => {
    it("should successfully fetch without retries", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ data: "test" }),
      };
      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const result = await fetchWithRetry("/data/test.json");

      expect(result).toBe(mockResponse);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("should retry on network failure with exponential backoff", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
      };
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(mockResponse);

      const promise = fetchWithRetry("/data/test.json");

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Wait for first retry (1000ms)
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetch).toHaveBeenCalledTimes(2);

      // Wait for second retry (2000ms)
      await vi.advanceTimersByTimeAsync(2000);
      await promise;

      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("should retry on HTTP error status", async () => {
      const mockSuccess = {
        ok: true,
        status: 200,
        statusText: "OK",
      };
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Server Error" })
        .mockResolvedValueOnce(mockSuccess);

      const promise = fetchWithRetry("/data/test.json");

      // First attempt fails
      await vi.advanceTimersByTimeAsync(0);

      // Wait for retry (1000ms)
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should throw error after max retries exhausted", async () => {
      const error = new Error("Network error");
      global.fetch = vi.fn().mockRejectedValue(error);

      const promise = fetchWithRetry("/data/test.json", {}, { maxRetries: 2 });

      // First attempt fails immediately
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("Network error");
      expect(fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("should use custom config for retries and delay", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
      };
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(mockResponse);

      const config = { maxRetries: 2, baseDelay: 500 };
      const promise = fetchWithRetry("/data/test.json", {}, config);

      // First attempt fails
      await vi.advanceTimersByTimeAsync(0);

      // First retry with custom delay (500ms)
      await vi.advanceTimersByTimeAsync(500);
      await promise;

      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should log retry attempts with console.warn", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn");
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
      };
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(mockResponse);

      const promise = fetchWithRetry("/data/test.json");
      await vi.runAllTimersAsync();
      await promise;

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("/data/test.json"),
        expect.stringContaining("attempt 1/3"),
        expect.stringContaining("retrying in 1000ms"),
        "Network error"
      );
    });
  });

  describe("retryWithBackoff", () => {
    it("should successfully complete operation without retries", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await retryWithBackoff(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry failed operation with exponential backoff", async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Operation failed"))
        .mockRejectedValueOnce(new Error("Operation failed"))
        .mockResolvedValueOnce("success");

      const promise = retryWithBackoff(operation, { baseDelay: 500 });

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      expect(operation).toHaveBeenCalledTimes(1);

      // First retry (500ms)
      await vi.advanceTimersByTimeAsync(500);
      expect(operation).toHaveBeenCalledTimes(2);

      // Second retry (1000ms)
      await vi.advanceTimersByTimeAsync(1000);
      await promise;

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should include context in error messages", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn");
      const consoleErrorSpy = vi.spyOn(console, "error");
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Database error"))
        .mockResolvedValueOnce("success");

      const promise = retryWithBackoff(operation, { context: "Database query" });
      await vi.runAllTimersAsync();
      await promise;

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Database query failed"),
        expect.stringContaining("attempt 1/3")
      );
    });

    it("should use default config when not provided", async () => {
      const operation = vi.fn().mockResolvedValue("success");

      const result = await retryWithBackoff(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should allow partial config overrides", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn");
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error("Fail"))
        .mockResolvedValueOnce("success");

      const promise = retryWithBackoff(operation, { maxRetries: 5 });
      await vi.runAllTimersAsync();
      await promise;

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("attempt 1/5")
      );
    });

    it("should log final error after all retries exhausted", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error");
      const operation = vi.fn().mockRejectedValue(new Error("Permanent failure"));

      const promise = retryWithBackoff(operation, { maxRetries: 2 });
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow("Permanent failure");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("operation failed after 2 attempts"),
        expect.any(Error)
      );
    });
  });
});

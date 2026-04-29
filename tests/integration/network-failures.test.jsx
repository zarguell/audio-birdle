import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchWithRetry, retryWithBackoff } from "@/utils/RetryUtils";
import { loadGameData } from "@/utils/LoadGameData";
import { createMockLocalStorage, createMockResponse } from "../setup";
import {
  createTestBirdList,
  createTestRegionList,
} from "../fixtures/integration-fixtures";

describe("Network Failure Integration", () => {
  let mockFetch;
  let mockStorage;
  let realSetTimeout;
  let setTimeoutCalls = [];

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    vi.stubGlobal("localStorage", mockStorage);

    mockFetch = vi.fn();
    global.fetch = mockFetch;

    setTimeoutCalls = [];
    realSetTimeout = global.setTimeout;
    global.setTimeout = vi.fn((fn, delay) => {
      setTimeoutCalls.push({ delay, fn });
      return realSetTimeout(fn, 0);
    });
  });

  afterEach(() => {
    global.setTimeout = realSetTimeout;
  });

  describe("Retry Logic Tests", () => {
    it("should retry on network error (ENOTFOUND)", async () => {
      const networkError = new Error("getaddrinfo ENOTFOUND");
      networkError.code = "ENOTFOUND";

      mockFetch
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(createMockResponse({ data: "success" }));

      const response = await fetchWithRetry("/api/test");
      expect(await response.json()).toEqual({ data: "success" });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should retry on HTTP 500 error", async () => {
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({ error: "Internal error" }, 500),
        )
        .mockResolvedValueOnce(
          createMockResponse({ error: "Internal error" }, 500),
        )
        .mockResolvedValueOnce(createMockResponse({ data: "success" }, 200));

      const response = await fetchWithRetry("/api/test");
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("should retry on HTTP 502 error", async () => {
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({ error: "Bad Gateway" }, 502),
        )
        .mockResolvedValueOnce(createMockResponse({ data: "success" }, 200));

      const response = await fetchWithRetry("/api/test");
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on HTTP 503 error", async () => {
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({ error: "Service Unavailable" }, 503),
        )
        .mockResolvedValueOnce(createMockResponse({ data: "success" }, 200));

      const response = await fetchWithRetry("/api/test");
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on HTTP 504 error", async () => {
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({ error: "Gateway Timeout" }, 504),
        )
        .mockResolvedValueOnce(createMockResponse({ data: "success" }, 200));

      const response = await fetchWithRetry("/api/test");
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on HTTP 404 (client error)", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ error: "Not Found" }, 404))
        .mockRejectedValueOnce(new Error("Still not found"));

      await expect(
        fetchWithRetry("/api/test", {}, { maxRetries: 2 }),
      ).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on HTTP 401 (auth error)", async () => {
      mockFetch
        .mockResolvedValueOnce(
          createMockResponse({ error: "Unauthorized" }, 401),
        )
        .mockRejectedValueOnce(new Error("Still unauthorized"));

      await expect(
        fetchWithRetry("/api/test", {}, { maxRetries: 2 }),
      ).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on HTTP 403 (forbidden)", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ error: "Forbidden" }, 403))
        .mockRejectedValueOnce(new Error("Still forbidden"));

      await expect(
        fetchWithRetry("/api/test", {}, { maxRetries: 2 }),
      ).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw error after all retries exhausted", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"));

      await expect(
        fetchWithRetry("/api/test", {}, { maxRetries: 3 }),
      ).rejects.toThrow("Network error");
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("Exponential Backoff Tests", () => {
    it("should increase delay with each retry (100ms → 200ms → 400ms)", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockResolvedValueOnce(createMockResponse({ data: "success" }));

      await fetchWithRetry("/api/test", {}, { maxRetries: 3, baseDelay: 100 });

      expect(setTimeoutCalls).toHaveLength(2);
      expect(setTimeoutCalls[0].delay).toBe(100);
      expect(setTimeoutCalls[1].delay).toBe(200);
    });

    it("should use custom baseDelay configuration", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockResolvedValueOnce(createMockResponse({ data: "success" }));

      await fetchWithRetry("/api/test", {}, { maxRetries: 2, baseDelay: 500 });

      expect(setTimeoutCalls).toHaveLength(1);
      expect(setTimeoutCalls[0].delay).toBe(500);
    });

    it("should use custom maxRetries configuration", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockRejectedValueOnce(new Error("Error 3"))
        .mockResolvedValueOnce(createMockResponse({ data: "success" }));

      await fetchWithRetry("/api/test", {}, { maxRetries: 4, baseDelay: 100 });

      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(setTimeoutCalls).toHaveLength(3);
    });

    it("should respect max total delay limit", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockRejectedValueOnce(new Error("Error 3"))
        .mockResolvedValueOnce(createMockResponse({ data: "success" }));

      await fetchWithRetry("/api/test", {}, { maxRetries: 4, baseDelay: 100 });

      const totalDelay = setTimeoutCalls.reduce(
        (sum, call) => sum + call.delay,
        0,
      );
      expect(totalDelay).toBeLessThan(5000);
    });
  });

  describe("Timeout Tests", () => {
    it("should handle fetch timeout with retry", async () => {
      const timeoutError = new Error("Request timeout");
      timeoutError.name = "AbortError";

      mockFetch
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce(createMockResponse({ data: "success" }));

      const response = await fetchWithRetry(
        "/api/test",
        {},
        { maxRetries: 2, baseDelay: 100 },
      );
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should not retry on success even if timeout configured", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ data: "success" }));

      const response = await fetchWithRetry("/api/test", {
        signal: AbortSignal.timeout(5000),
      });
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should handle custom timeout configuration", async () => {
      const abortController = new AbortController();
      const timeoutError = new Error("Custom timeout");
      timeoutError.name = "AbortError";

      mockFetch
        .mockImplementationOnce(() => {
          setTimeout(() => abortController.abort(), 100);
          return fetch("/api/test", { signal: abortController.signal });
        })
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce(createMockResponse({ data: "success" }));

      const response = await fetchWithRetry(
        "/api/test",
        {},
        { maxRetries: 2, baseDelay: 100 },
      );
      expect(response.ok).toBe(true);
    });
  });

  describe("Recovery Tests", () => {
    it("should recover after initial failure and retry", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(createMockResponse({ data: "success" }));

      const response = await fetchWithRetry("/api/test");
      expect(await response.json()).toEqual({ data: "success" });
    });

    it("should recover after multiple retries", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockRejectedValueOnce(new Error("Error 3"))
        .mockResolvedValueOnce(createMockResponse({ data: "success" }));

      const response = await fetchWithRetry("/api/test", {}, { maxRetries: 4 });
      expect(await response.json()).toEqual({ data: "success" });
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("should gracefully degrade when unavailable after all retries", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Error 1"))
        .mockRejectedValueOnce(new Error("Error 2"))
        .mockRejectedValueOnce(new Error("Error 3"));

      await expect(
        fetchWithRetry("/api/test", {}, { maxRetries: 3 }),
      ).rejects.toThrow();
    });

    it("should handle recovery with mixed error types", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(
          createMockResponse({ error: "Internal error" }, 500),
        )
        .mockResolvedValueOnce(createMockResponse({ data: "success" }, 200));

      const response = await fetchWithRetry("/api/test", {}, { maxRetries: 3 });
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("Concurrent Request Tests", () => {
    it("should handle multiple concurrent requests with retry", async () => {
      mockFetch.mockImplementation((url) => {
        if (url === "/api/test1") {
          return Promise.reject(new Error("Error 1"));
        } else if (url === "/api/test2") {
          return Promise.resolve(createMockResponse({ data: "success2" }, 200));
        }
      });

      const results = await Promise.allSettled([
        fetchWithRetry("/api/test1", {}, { maxRetries: 1 }),
        fetchWithRetry("/api/test2", {}, { maxRetries: 1 }),
      ]);

      expect(results[0].status).toBe("rejected");
      expect(results[1].status).toBe("fulfilled");
      expect(await results[1].value.json()).toEqual({ data: "success2" });
    });

    it("should isolate errors between concurrent requests", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse({ data: "success" }, 200))
        .mockRejectedValueOnce(new Error("Failed"))
        .mockRejectedValueOnce(new Error("Failed"));

      const results = await Promise.allSettled([
        fetchWithRetry("/api/success", {}, { maxRetries: 2 }),
        fetchWithRetry("/api/fail", {}, { maxRetries: 2 }),
      ]);

      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("rejected");
    });

    it("should not have race conditions in retry logic", async () => {
      let callOrder = [];

      mockFetch.mockImplementation(async () => {
        callOrder.push(new Date());
        await new Promise((resolve) => realSetTimeout(resolve, 10));
        if (mockFetch.mock.calls.length <= 2) {
          throw new Error("Retry needed");
        }
        return createMockResponse({ data: "success" });
      });

      await fetchWithRetry("/api/test", {}, { maxRetries: 3, baseDelay: 50 });

      expect(callOrder).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe("Audio URL Failure Tests", () => {
    it("should handle audio playback with network error", async () => {
      mockFetch.mockRejectedValue(new Error("Audio not found"));

      await expect(fetchWithRetry("/audio/bird.mp3")).rejects.toThrow();
    });

    it("should handle fallback to next URL in array", async () => {
      const audioUrls = [
        "/audio/bird1.mp3",
        "/audio/bird2.mp3",
        "/audio/bird3.mp3",
      ];

      mockFetch
        .mockRejectedValueOnce(new Error("URL 1 failed"))
        .mockRejectedValueOnce(new Error("URL 2 failed"))
        .mockResolvedValueOnce(createMockResponse(new ArrayBuffer(1024), 200));

      let response = null;
      let success = false;
      for (const url of audioUrls) {
        try {
          response = await fetchWithRetry(
            url,
            {},
            { maxRetries: 1, baseDelay: 50 },
          );
          success = true;
          break;
        } catch {
          continue;
        }
      }

      expect(success).toBe(true);
      expect(response).not.toBeNull();
      expect(response.ok).toBe(true);
    });

    it("should track all failed URLs", async () => {
      const audioUrls = ["/audio/1.mp3", "/audio/2.mp3", "/audio/3.mp3"];
      const failedUrls = [];

      mockFetch.mockRejectedValue(new Error("Network error"));

      for (const url of audioUrls) {
        try {
          await fetchWithRetry(url, {}, { maxRetries: 1, baseDelay: 50 });
        } catch {
          failedUrls.push(url);
        }
      }

      expect(failedUrls).toEqual(audioUrls);
    });

    it("should handle when all audio URLs fail", async () => {
      const audioUrls = ["/audio/1.mp3", "/audio/2.mp3", "/audio/3.mp3"];

      mockFetch.mockRejectedValue(new Error("Network error"));

      let success = false;
      for (const url of audioUrls) {
        try {
          await fetchWithRetry(url, {}, { maxRetries: 1, baseDelay: 50 });
          success = true;
          break;
        } catch {
          continue;
        }
      }

      expect(success).toBe(false);
    });
  });

  describe("RetryWithBackoff Generic Tests", () => {
    it("should retry any async operation", async () => {
      let attempts = 0;

      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error("Not ready yet");
        }
        return "success";
      };

      const result = await retryWithBackoff(operation, {
        maxRetries: 3,
        baseDelay: 100,
      });
      expect(result).toBe("success");
      expect(attempts).toBe(3);
    });

    it("should pass context to error messages", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockFetch
        .mockRejectedValueOnce(new Error("Test error"))
        .mockRejectedValueOnce(new Error("Test error"));

      try {
        await fetchWithRetry(
          "/api/test",
          {},
          { maxRetries: 2, baseDelay: 100 },
        );
      } catch {
        // Expected - testing error handling
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/test"),
        expect.any(String),
      );

      consoleSpy.mockRestore();
    });

    it("should handle operation that succeeds on first try", async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({ data: "success" }));

      const response = await fetchWithRetry("/api/test");
      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(setTimeoutCalls).toHaveLength(0);
    });
  });

  describe("LoadGameData with Network Failures", () => {
    it("should handle regions.json fetch failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(loadGameData()).rejects.toThrow();
    });

    it("should handle birds.json fetch failure after regions success", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createTestRegionList()))
        .mockRejectedValue(new Error("Network error"));

      await expect(loadGameData()).rejects.toThrow();
    });

    it("should recover from intermittent network errors", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(createMockResponse(createTestRegionList()))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(
          createMockResponse({ us: createTestBirdList(10) }),
        );

      const data = await loadGameData();
      expect(data.regions).toBeDefined();
      expect(data.birds).toBeDefined();
      expect(data.birds.us).toHaveLength(10);
    });

    it("should handle partial data loading with retry", async () => {
      mockFetch
        .mockResolvedValueOnce(createMockResponse(createTestRegionList()))
        .mockResolvedValueOnce(createMockResponse({ us: [] }, 500))
        .mockResolvedValueOnce(
          createMockResponse({ us: createTestBirdList(5) }, 200),
        );

      const data = await loadGameData();
      expect(data.regions).toBeDefined();
      expect(data.birds.us).toHaveLength(5);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getServiceWorker,
  checkDailyJsonUpdate,
  checkForUpdates,
  storeVersionInfo,
  storeDailyJsonVersionInfo,
  storeBirdsJsonVersionInfo,
  checkBirdsJsonUpdate,
  hasDateChanged,
  clearServiceWorkerCache,
  refreshGameData,
} from "@/utils/CacheUtils";
import { STORAGE_KEYS } from "@/utils/Constants";

describe("CacheUtils", () => {
  let originalNavigator;
  let originalLocalStorage;
  let checkDataFileUpdateMock;
  let invalidateDailyBirdCacheSpy;

  beforeEach(async () => {
    const versionUtils = await import("@/utils/versionUtils");
    checkDataFileUpdateMock = vi.spyOn(versionUtils, "checkDataFileUpdate");

    const dailyBirdUtils = await import("@/utils/DailyBirdUtils");
    invalidateDailyBirdCacheSpy = vi.spyOn(
      dailyBirdUtils,
      "invalidateDailyBirdCache",
    );

    // Deterministic clock for all date-sensitive behavior
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T12:00:00.000Z"));

    originalNavigator = global.navigator;
    originalLocalStorage = global.localStorage;

    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      get length() {
        return 0;
      },
      key: vi.fn(),
    };

    global.caches = {
      keys: vi.fn(),
      delete: vi.fn(),
    };
  });

  afterEach(() => {
    global.navigator = originalNavigator;
    global.localStorage = originalLocalStorage;
    vi.useRealTimers();
  });

  describe("getServiceWorker", () => {
    it("should return null if serviceWorker not supported", async () => {
      global.navigator = { serviceWorker: undefined };

      const result = await getServiceWorker();

      expect(result).toBeNull();
    });

    it("should return registration if serviceWorker available", async () => {
      const mockRegistration = { scope: "/" };
      const getRegistrationMock = vi.fn().mockResolvedValue(mockRegistration);
      global.navigator.serviceWorker = { getRegistration: getRegistrationMock };

      const result = await getServiceWorker();

      expect(result).toBe(mockRegistration);
    });

    it("should return null on error", async () => {
      const getRegistrationMock = vi
        .fn()
        .mockRejectedValue(new Error("SW error"));
      global.navigator.serviceWorker = { getRegistration: getRegistrationMock };

      const result = await getServiceWorker();

      expect(result).toBeNull();
    });
  });

  describe("checkDailyJsonUpdate", () => {
    it("should call checkDataFileUpdate with correct keys", async () => {
      checkDataFileUpdateMock.mockResolvedValue({
        hasUpdate: true,
        serverVersion: "2025-01-15",
        cachedVersion: "2025-01-14",
      });

      const result = await checkDailyJsonUpdate();

      expect(result.hasUpdate).toBe(true);
      expect(result.serverVersion).toBe("2025-01-15");
    });
  });

  describe("checkForUpdates", () => {
    it("should return true if regions.json has update", async () => {
      checkDataFileUpdateMock
        .mockResolvedValueOnce({ hasUpdate: true, serverVersion: "v2" })
        .mockResolvedValueOnce({ hasUpdate: false });

      const result = await checkForUpdates();

      expect(result.hasUpdate).toBe(true);
      expect(result.serverVersion).toBe("v2");
    });

    it("should return true if daily.json has update", async () => {
      checkDataFileUpdateMock
        .mockResolvedValueOnce({ hasUpdate: false })
        .mockResolvedValueOnce({ hasUpdate: true });

      const result = await checkForUpdates();

      expect(result.hasUpdate).toBe(true);
      expect(result.dailyJsonUpdate).toBe(true);
    });

    it("should return false if no updates", async () => {
      checkDataFileUpdateMock.mockResolvedValue({ hasUpdate: false });

      const result = await checkForUpdates();

      expect(result.hasUpdate).toBe(false);
      expect(result.dailyJsonUpdate).toBe(false);
    });
  });

  describe("storeVersionInfo", () => {
    it("should store version info from response headers", () => {
      const mockResponse = {
        headers: {
          get: vi
            .fn()
            .mockReturnValueOnce("Wed, 15 Jan 2025 12:00:00 GMT")
            .mockReturnValueOnce("1234567890"),
        },
      };

      storeVersionInfo(mockResponse);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.CACHE_LAST_MODIFIED,
        '"Wed, 15 Jan 2025 12:00:00 GMT"',
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.CACHE_ETAG,
        '"1234567890"',
      );
    });

    it("should not store if headers are null", () => {
      const mockResponse = {
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      };

      storeVersionInfo(mockResponse);

      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe("storeDailyJsonVersionInfo", () => {
    it("should store version info and date", () => {
      const mockResponse = {
        headers: {
          get: vi
            .fn()
            .mockReturnValueOnce("Wed, 15 Jan 2025 12:00:00 GMT")
            .mockReturnValueOnce("0987654321"),
        },
      };

      storeDailyJsonVersionInfo(mockResponse);

      expect(localStorage.setItem).toHaveBeenNthCalledWith(
        1,
        STORAGE_KEYS.DAILY_JSON_LAST_MODIFIED,
        '"Wed, 15 Jan 2025 12:00:00 GMT"',
      );
      expect(localStorage.setItem).toHaveBeenNthCalledWith(
        2,
        STORAGE_KEYS.DAILY_JSON_ETAG,
        '"0987654321"',
      );
      // System time is fixed at 2025-01-15T12:00:00Z
      expect(localStorage.setItem).toHaveBeenNthCalledWith(
        4,
        STORAGE_KEYS.LAST_VALIDATED_DATE,
        '"2025-01-15"',
      );
    });

    it("should not throw if version info is null", () => {
      const mockResponse = {
        headers: {
          get: vi.fn().mockReturnValue(null),
        },
      };

      expect(() => storeDailyJsonVersionInfo(mockResponse)).not.toThrow();
    });
  });

  describe("storeBirdsJsonVersionInfo", () => {
    it("should store birds.json version info", () => {
      const mockResponse = {
        headers: {
          get: vi
            .fn()
            .mockReturnValueOnce("Wed, 15 Jan 2025 10:00:00 GMT")
            .mockReturnValueOnce("birds-v2"),
        },
      };

      storeBirdsJsonVersionInfo(mockResponse);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BIRDS_JSON_LAST_MODIFIED,
        '"Wed, 15 Jan 2025 10:00:00 GMT"',
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BIRDS_JSON_ETAG,
        '"birds-v2"',
      );
    });
  });

  describe("checkBirdsJsonUpdate", () => {
    it("should call checkDataFileUpdate with correct keys", async () => {
      checkDataFileUpdateMock.mockResolvedValue({
        hasUpdate: true,
        serverVersion: "birds-v2",
        cachedVersion: "birds-v1",
      });

      const result = await checkBirdsJsonUpdate();

      expect(result.hasUpdate).toBe(true);
      expect(result.serverVersion).toBe("birds-v2");
    });
  });

  describe("hasDateChanged", () => {
    it("should return true if no last validated date", () => {
      localStorage.getItem.mockReturnValue(null);

      const result = hasDateChanged();

      expect(result).toBe(true);
    });

    it("should return true if date changed", () => {
      localStorage.getItem.mockReturnValue('"2025-01-14"');

      const result = hasDateChanged();

      expect(result).toBe(true);
    });

    it("should return false if date is same", () => {
      localStorage.getItem.mockReturnValue('"2025-01-15"');

      const result = hasDateChanged();

      expect(result).toBe(false);
    });
  });

  describe("clearServiceWorkerCache", () => {
    it("should clear all caches", async () => {
      global.caches.keys.mockResolvedValue(["cache-v1", "cache-v2"]);
      global.caches.delete.mockResolvedValue(true);

      const result = await clearServiceWorkerCache();

      expect(result).toBe(true);
      expect(caches.keys).toHaveBeenCalled();
      expect(caches.delete).toHaveBeenCalledTimes(2);
    });

    it("should invalidate the daily bird cache", async () => {
      global.caches.keys.mockResolvedValue([]);

      await clearServiceWorkerCache();

      expect(invalidateDailyBirdCacheSpy).toHaveBeenCalled();
    });

    it("should return false on error", async () => {
      global.caches.keys.mockRejectedValue(new Error("Cache error"));

      const result = await clearServiceWorkerCache();

      expect(result).toBe(false);
    });
  });

  describe("refreshGameData", () => {
    beforeEach(() => {
      global.fetch = vi.fn();
    });

    it("should fetch all data files with no-cache headers", async () => {
      const mockRegions = { us: [{ id: "us", name: "United States" }] };
      const mockBirds = { us: [{ id: "amerob", name: "American Robin" }] };
      const mockDaily = [
        { date: "2025-01-15", region: "us", answerHash: "abc123" },
      ];

      global.fetch.mockImplementation((url) => {
        if (url.includes("regions.json")) {
          return Promise.resolve({
            ok: true,
            headers: { get: vi.fn().mockReturnValue("version-1") },
            json: async () => mockRegions,
          });
        } else if (url.includes("birds.json")) {
          return Promise.resolve({
            ok: true,
            headers: { get: vi.fn().mockReturnValue("version-2") },
            json: async () => mockBirds,
          });
        } else if (url.includes("daily.json")) {
          return Promise.resolve({
            ok: true,
            headers: { get: vi.fn().mockReturnValue("version-3") },
            json: async () => mockDaily,
          });
        } else {
          return Promise.resolve({
            ok: true,
            headers: { get: vi.fn().mockReturnValue("version") },
            json: async () => (url.includes("history") ? [] : {}),
          });
        }
      });

      const result = await refreshGameData();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/data\/regions\.json\?t=/),
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
        },
      );
      expect(result.regions).toEqual(mockRegions);
      expect(result.birds).toEqual(mockBirds);
    });

    it("should record the birds.json version (fixes infinite update loop)", async () => {
      const mockRegions = { us: [] };
      const mockBirds = { us: [] };
      const mockDaily = [];

      global.fetch.mockImplementation((url) =>
        Promise.resolve({
          ok: true,
          headers: { get: vi.fn().mockReturnValue(`version-${url.split("?")[0]}`) },
          json: async () =>
            url.includes("regions.json")
              ? mockRegions
              : url.includes("birds.json")
                ? mockBirds
                : url.includes("daily.json")
                  ? mockDaily
                  : {},
        }),
      );

      await refreshGameData();

      // birds.json version must be stored so checkBirdsJsonUpdate() sees a match
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BIRDS_JSON_LAST_MODIFIED,
        '"version-/data/birds.json"',
      );
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.BIRDS_JSON_ETAG,
        '"version-/data/birds.json"',
      );
    });

    it("must not let daily-subregion-birds.json overwrite results.birds (regression)", async () => {
      // Regression: file matching used .includes(), and
      // "/data/daily-subregion-birds.json".includes("birds.json") is true,
      // so the subregion map REPLACED the real bird list after every refresh,
      // breaking the daily challenge (no options / empty autocomplete).
      const mockBirds = { us: [{ id: "amerob", name: "American Robin" }] };
      const subregionMap = { us: { Alabama: ["amerob"], Alaska: [] } };
      global.fetch.mockImplementation((url) => {
        const path = url.split("?")[0];
        const body =
          path === "/data/birds.json"
            ? mockBirds
            : path === "/data/daily-subregion-birds.json"
              ? subregionMap
              : [];
        return Promise.resolve({
          ok: true,
          headers: { get: vi.fn().mockReturnValue("version") },
          json: async () => body,
        });
      });

      const result = await refreshGameData();

      expect(result.birds).toEqual(mockBirds);
      expect(result.birds).not.toEqual(subregionMap);
    });

    it("should invalidate the daily bird cache on refresh", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        headers: { get: vi.fn().mockReturnValue("version") },
        json: async () => ({}),
      });

      await refreshGameData();

      expect(invalidateDailyBirdCacheSpy).toHaveBeenCalled();
    });

    it("should throw error on failed fetch", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(refreshGameData()).rejects.toThrow(
        "Failed to fetch /data/regions.json: 404",
      );
    });

    it("should call onProgress callback", async () => {
      const progressCallback = vi.fn();
      global.fetch.mockResolvedValue({
        ok: true,
        headers: { get: vi.fn().mockReturnValue("version") },
        json: async () => ({}),
      });

      await refreshGameData(progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(5);
      expect(progressCallback).toHaveBeenCalledWith(1, 5, "/data/regions.json");
      expect(progressCallback).toHaveBeenCalledWith(
        5,
        5,
        "/data/daily-subregion-birds.json",
      );
    });
  });
});

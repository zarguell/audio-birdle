import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  hashBirdId,
  findBirdByHash,
  loadDailyBirdData,
  getTodaysBirdFromDaily,
  generateDailyEntry,
  invalidateDailyBirdCache,
} from "@/utils/DailyBirdUtils";
import { fetchWithRetry } from "@/utils/RetryUtils";
import { sampleBirds, sampleDailyData } from "../fixtures/sampleBirds";

// Mock RetryUtils
vi.mock("@/utils/RetryUtils", () => ({
  fetchWithRetry: vi.fn(),
}));

describe("DailyBirdUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Module-level daily cache persists across tests — bust it for isolation
    invalidateDailyBirdCache();
  });

  describe("hashBirdId", () => {
    it("should hash bird ID correctly", () => {
      const hash = hashBirdId("amerob");

      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBe(8);
    });

    it("should produce consistent hashes", () => {
      const hash1 = hashBirdId("amerob");
      const hash2 = hashBirdId("amerob");

      expect(hash1).toBe(hash2);
    });

    it("should produce different hashes for different IDs", () => {
      const hash1 = hashBirdId("amerob");
      const hash2 = hashBirdId("barswa");

      expect(hash1).not.toBe(hash2);
    });

    it("should handle special characters in bird ID", () => {
      const hash = hashBirdId("bird-with-dash");

      expect(hash).toBeDefined();
      expect(hash.length).toBe(8);
    });

    it("should handle empty string", () => {
      const hash = hashBirdId("");

      expect(hash).toBeDefined();
      expect(hash.length).toBe(8);
    });
  });

  describe("findBirdByHash", () => {
    it("should find bird by hash", () => {
      const bird = sampleBirds.us[0];
      const hash = hashBirdId(bird.id);
      const found = findBirdByHash(sampleBirds.us, hash);

      expect(found).toBeDefined();
      expect(found.id).toBe(bird.id);
      expect(found.name).toBe(bird.name);
    });

    it("should return null if hash not found", () => {
      const found = findBirdByHash(sampleBirds.us, "invalidhash");

      expect(found).toBeNull();
    });

    it("should handle null birds array", () => {
      const found = findBirdByHash(null, "hash");

      expect(found).toBeNull();
    });

    it("should handle null hash", () => {
      const found = findBirdByHash(sampleBirds.us, null);

      expect(found).toBeNull();
    });

    it("should handle undefined hash", () => {
      const found = findBirdByHash(sampleBirds.us, undefined);

      expect(found).toBeNull();
    });

    it("should be case insensitive for hash", () => {
      const bird = sampleBirds.us[0];
      const hash = hashBirdId(bird.id);
      const found = findBirdByHash(sampleBirds.us, hash.toUpperCase());

      expect(found).toBeDefined();
      expect(found.id).toBe(bird.id);
    });

    it("should handle empty birds array", () => {
      const hash = hashBirdId("amerob");
      const found = findBirdByHash([], hash);

      expect(found).toBeNull();
    });
  });

  describe("loadDailyBirdData", () => {
    it("should load daily data successfully", async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleDailyData,
      });

      const data = await loadDailyBirdData();

      expect(data).toEqual(sampleDailyData);
      expect(fetchWithRetry).toHaveBeenCalledWith(
        "/data/daily.json",
        {},
        { maxRetries: 3, baseDelay: 500 },
      );
    });

    it("should handle HTTP errors", async () => {
      const error = new Error("HTTP 404: Not Found for /data/daily.json");
      fetchWithRetry.mockRejectedValueOnce(error);

      await expect(loadDailyBirdData()).rejects.toThrow("HTTP 404");
    });

    it("should validate data is array", async () => {
      const badResponse = { ok: true, json: async () => ({ not: "an array" }) };
      fetchWithRetry.mockResolvedValueOnce(badResponse);

      await expect(loadDailyBirdData()).rejects.toThrow(
        "Daily data must be an array",
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network error");
      fetchWithRetry.mockRejectedValueOnce(networkError);

      await expect(loadDailyBirdData()).rejects.toThrow("Network error");
    });

    it("should handle empty array", async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const data = await loadDailyBirdData();

      expect(data).toEqual([]);
      expect(Array.isArray(data)).toBe(true);
    });

    it("should handle malformed JSON", async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      await expect(loadDailyBirdData()).rejects.toThrow();
    });

    it("should cache parsed data and not refetch until invalidated", async () => {
      fetchWithRetry.mockResolvedValue({
        ok: true,
        json: async () => sampleDailyData,
      });

      const first = await loadDailyBirdData();
      const second = await loadDailyBirdData();

      expect(first).toEqual(sampleDailyData);
      expect(second).toBe(first);
      expect(fetchWithRetry).toHaveBeenCalledTimes(1);

      invalidateDailyBirdCache();

      await loadDailyBirdData();
      expect(fetchWithRetry).toHaveBeenCalledTimes(2);
    });

    it("should not cache non-array data", async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ not: "an array" }),
      });

      await expect(loadDailyBirdData()).rejects.toThrow();
      // A later valid load must not be served from a partial cache
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleDailyData,
      });
      const data = await loadDailyBirdData();
      expect(data).toEqual(sampleDailyData);
    });
  });

  describe("getTodaysBirdFromDaily", () => {
    it("should get today's bird", async () => {
      const bird = sampleBirds.us[0];
      const hash = hashBirdId(bird.id);
      const dailyData = [
        { date: "2025-12-27", region: "us", answerHash: hash },
      ];

      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => dailyData,
      });

      const found = await getTodaysBirdFromDaily(
        "us",
        sampleBirds.us,
        "2025-12-27",
      );

      expect(found.success).toBe(true);
      expect(found.bird.id).toBe(bird.id);
      expect(found.bird.name).toBe(bird.name);
    });

    it("should return not_found if no entry on or before date", async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const found = await getTodaysBirdFromDaily(
        "us",
        sampleBirds.us,
        "2025-12-27",
      );

      expect(found).toEqual({ success: false, error: "not_found" });
    });

    it("should return not_found if no entry for region", async () => {
      const bird = sampleBirds.us[0];
      const hash = hashBirdId(bird.id);
      const dailyData = [
        { date: "2025-12-27", region: "eu", answerHash: hash },
      ];

      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => dailyData,
      });

      const found = await getTodaysBirdFromDaily(
        "us",
        sampleBirds.us,
        "2025-12-27",
      );

      expect(found).toEqual({ success: false, error: "not_found" });
    });

    it("should return network error when daily data fetch fails", async () => {
      fetchWithRetry.mockRejectedValueOnce(new Error("Network error"));

      const found = await getTodaysBirdFromDaily(
        "us",
        sampleBirds.us,
        "2025-12-27",
      );

      expect(found).toEqual({ success: false, error: "network" });
    });

    it("should return network error for non-array daily data", async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ not: "an array" }),
      });

      const found = await getTodaysBirdFromDaily(
        "us",
        sampleBirds.us,
        "2025-12-27",
      );

      expect(found).toEqual({ success: false, error: "network" });
    });

    it("should return not_found if bird hash not found", async () => {
      const dailyData = [
        { date: "2025-12-27", region: "us", answerHash: "invalidhash" },
      ];

      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => dailyData,
      });

      const found = await getTodaysBirdFromDaily(
        "us",
        sampleBirds.us,
        "2025-12-27",
      );

      expect(found).toEqual({ success: false, error: "not_found" });
    });

    it("should match date and region", async () => {
      const bird1 = sampleBirds.us[0];
      const bird2 = sampleBirds.us[1];
      const hash1 = hashBirdId(bird1.id);
      const hash2 = hashBirdId(bird2.id);

      const dailyData = [
        { date: "2025-12-27", region: "us", answerHash: hash1 },
        { date: "2025-12-27", region: "eu", answerHash: hash2 },
        { date: "2025-12-26", region: "us", answerHash: hash2 },
      ];

      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => dailyData,
      });

      const found = await getTodaysBirdFromDaily(
        "us",
        sampleBirds.us,
        "2025-12-27",
      );

      expect(found.success).toBe(true);
      expect(found.bird.id).toBe(bird1.id);
    });

    it("should pick the latest entry on or before the requested date (UTC-stamped daily vs local today)", async () => {
      const bird1 = sampleBirds.us[0];
      const bird2 = sampleBirds.us[1];
      const hash1 = hashBirdId(bird1.id);
      const hash2 = hashBirdId(bird2.id);

      const dailyData = [
        { date: "2025-12-27", region: "us", answerHash: hash1 },
        { date: "2025-12-26", region: "us", answerHash: hash2 },
      ];

      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => dailyData,
      });

      // Querying a date with no exact entry falls back to the latest <= date
      const found = await getTodaysBirdFromDaily(
        "us",
        sampleBirds.us,
        "2025-12-28",
      );

      expect(found.success).toBe(true);
      expect(found.bird.id).toBe(bird1.id);
    });

    it("should pick an earlier entry when no entry exists for the exact date", async () => {
      const bird1 = sampleBirds.us[0];
      const bird2 = sampleBirds.us[1];
      const hash1 = hashBirdId(bird1.id);
      const hash2 = hashBirdId(bird2.id);

      const dailyData = [
        { date: "2025-12-26", region: "us", answerHash: hash2 },
        { date: "2025-12-25", region: "us", answerHash: hash1 },
      ];

      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => dailyData,
      });

      const found = await getTodaysBirdFromDaily(
        "us",
        sampleBirds.us,
        "2025-12-27",
      );

      expect(found.success).toBe(true);
      expect(found.bird.id).toBe(bird2.id);
    });

    it("should return not_found when all entries are after the requested date", async () => {
      const bird = sampleBirds.us[0];
      const hash = hashBirdId(bird.id);
      const dailyData = [
        { date: "2025-12-28", region: "us", answerHash: hash },
      ];

      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => dailyData,
      });

      const found = await getTodaysBirdFromDaily(
        "us",
        sampleBirds.us,
        "2025-12-27",
      );

      expect(found).toEqual({ success: false, error: "not_found" });
    });
  });

  describe("generateDailyEntry", () => {
    it("should generate daily entry", () => {
      const entry = generateDailyEntry("2025-12-27", "us", "amerob");

      expect(entry.date).toBe("2025-12-27");
      expect(entry.region).toBe("us");
      expect(entry.answerHash).toBeDefined();
      expect(entry.answerHash.length).toBe(8);
    });

    it("should generate hash for bird ID", () => {
      const entry = generateDailyEntry("2025-12-27", "us", "amerob");
      const directHash = hashBirdId("amerob");

      expect(entry.answerHash).toBe(directHash);
    });

    it("should handle different dates", () => {
      const entry1 = generateDailyEntry("2025-12-27", "us", "amerob");
      const entry2 = generateDailyEntry("2025-12-26", "us", "amerob");

      expect(entry1.date).not.toBe(entry2.date);
      expect(entry1.answerHash).toBe(entry2.answerHash); // Same bird, same hash
    });

    it("should handle different regions", () => {
      const entry1 = generateDailyEntry("2025-12-27", "us", "amerob");
      const entry2 = generateDailyEntry("2025-12-27", "eu", "amerob");

      expect(entry1.region).not.toBe(entry2.region);
      expect(entry1.answerHash).toBe(entry2.answerHash); // Same bird, same hash
    });

    it("should handle different birds", () => {
      const entry1 = generateDailyEntry("2025-12-27", "us", "amerob");
      const entry2 = generateDailyEntry("2025-12-27", "us", "barswa");

      expect(entry1.answerHash).not.toBe(entry2.answerHash);
    });

    it("should have all required fields", () => {
      const entry = generateDailyEntry("2025-12-27", "us", "amerob");

      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("region");
      expect(entry).toHaveProperty("answerHash");
    });

    it("should generate consistent hashes for same bird", () => {
      const entry1 = generateDailyEntry("2025-12-27", "us", "amerob");
      const entry2 = generateDailyEntry("2025-12-27", "us", "amerob");

      expect(entry1.answerHash).toBe(entry2.answerHash);
    });
  });
});

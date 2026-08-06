import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadGameData,
  isHttpsUrl,
  invalidateSubregionBirdsCache,
} from "@/utils/LoadGameData";

// Common subregion map used by exclusion tests
const SUBREGION_BIRDS = {
  us: {
    Alaska: [{ id: "aldfly" }, { id: "barswa" }],
    Hawaii: [{ id: "reccro" }],
  },
};

const US_LOWER48_REGION = {
  id: "us-lower48",
  name: "US Lower 48",
  country: "US",
  parentRegion: "us",
  excludedSubregions: ["Alaska", "Hawaii"],
};

describe("LoadGameData", () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
    // Module-level subregion cache persists across tests — bust it for isolation
    invalidateSubregionBirdsCache();
  });

  describe("isHttpsUrl", () => {
    it("should accept https URLs", () => {
      expect(isHttpsUrl("https://example.com/audio.mp3")).toBe(true);
      expect(isHttpsUrl("https://example.com")).toBe(true);
    });

    it("should reject http URLs", () => {
      expect(isHttpsUrl("http://example.com/audio.mp3")).toBe(false);
    });

    it("should reject javascript: URLs", () => {
      expect(isHttpsUrl("javascript:alert(1)")).toBe(false);
    });

    it("should reject data: URLs", () => {
      expect(isHttpsUrl("data:audio/wav;base64,UklGR")).toBe(false);
    });

    it("should reject relative and malformed URLs", () => {
      expect(isHttpsUrl("/audio/bird.mp3")).toBe(false);
      expect(isHttpsUrl("not a url")).toBe(false);
    });

    it("should reject non-string values", () => {
      expect(isHttpsUrl(null)).toBe(false);
      expect(isHttpsUrl(undefined)).toBe(false);
      expect(isHttpsUrl(42)).toBe(false);
      expect(isHttpsUrl({ url: "https://example.com" })).toBe(false);
      expect(isHttpsUrl("")).toBe(false);
    });
  });

  describe("URL sanitization (M3)", () => {
    it("should filter audioUrl arrays to https strings", async () => {
      const mockRegions = [{ id: "us", name: "United States", country: "US" }];
      const mockBirds = {
        us: [
          {
            id: "amerob",
            name: "American Robin",
            audioUrl: [
              "https://example.com/ok.mp3",
              "javascript:alert(1)",
              "data:audio/wav;base64,UklGR",
              "http://insecure.example.com/audio.mp3",
              { url: "https://example.com/ok2.mp3" },
              { url: "javascript:alert(2)" },
            ],
          },
        ],
      };

      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockRegions })
        .mockResolvedValueOnce({ ok: true, json: async () => mockBirds });

      const result = await loadGameData();

      // String entries kept as strings, object entries kept as objects —
      // only non-https entries are dropped
      expect(result.birds.us[0].audioUrl).toEqual([
        "https://example.com/ok.mp3",
        { url: "https://example.com/ok2.mp3" },
      ]);
      expect(result.birds.us[0].audioUrl).toHaveLength(2);
    });

    it("should drop non-https learnMoreUrl and images", async () => {
      const mockRegions = [{ id: "us", name: "United States", country: "US" }];
      const mockBirds = {
        us: [
          {
            id: "amerob",
            name: "American Robin",
            audioUrl: ["https://example.com/ok.mp3"],
            learnMoreUrl: "javascript:alert(1)",
            images: [
              { url: "https://example.com/ok.jpg" },
              { url: "javascript:alert(1)" },
              { url: "data:image/png;base64,AAAA" },
            ],
          },
        ],
      };

      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockRegions })
        .mockResolvedValueOnce({ ok: true, json: async () => mockBirds });

      const result = await loadGameData();

      expect(result.birds.us[0].learnMoreUrl).toBeUndefined();
      expect(result.birds.us[0].images).toEqual([
        { url: "https://example.com/ok.jpg" },
      ]);
    });

    it("should keep valid https learnMoreUrl", async () => {
      const mockRegions = [{ id: "us", name: "United States", country: "US" }];
      const mockBirds = {
        us: [
          {
            id: "amerob",
            name: "American Robin",
            audioUrl: ["https://example.com/ok.mp3"],
            learnMoreUrl: "https://birdsoftheworld.org/species/x",
            images: [{ url: "https://example.com/ok.jpg" }],
          },
        ],
      };

      global.fetch
        .mockResolvedValueOnce({ ok: true, json: async () => mockRegions })
        .mockResolvedValueOnce({ ok: true, json: async () => mockBirds });

      const result = await loadGameData();

      expect(result.birds.us[0].learnMoreUrl).toBe(
        "https://birdsoftheworld.org/species/x",
      );
      expect(result.birds.us[0].images).toHaveLength(1);
    });
  });

  describe("Virtual Region Support", () => {
    it("should load regions and birds data successfully", async () => {
      const mockRegions = [{ id: "us", name: "United States", country: "US" }];
      const mockBirds = {
        us: [{ id: "amerob", name: "American Robin" }],
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRegions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBirds,
        });

      const result = await loadGameData();

      expect(result.regions).toEqual(mockRegions);
      expect(result.birds).toEqual(mockBirds);
    });

    it("should add virtual region bird data from parent region", async () => {
      const mockRegions = [
        { id: "us", name: "United States", country: "US" },
        US_LOWER48_REGION,
      ];
      const mockBirds = {
        us: [{ id: "amerob", name: "American Robin" }],
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRegions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBirds,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => SUBREGION_BIRDS,
        });

      const result = await loadGameData();

      // us-lower48 gets the parent list minus excluded subregion birds
      expect(result.birds["us-lower48"]).toEqual(mockBirds.us);
    });

    it("should exclude birds that appear only in excluded subregions", async () => {
      const mockRegions = [
        { id: "us", name: "United States", country: "US" },
        US_LOWER48_REGION,
      ];
      const mockBirds = {
        us: [
          { id: "amerob", name: "American Robin" },
          { id: "aldfly", name: "Alder Flycatcher" },
          { id: "barswa", name: "Barn Swallow" },
          { id: "reccro", name: "Red-crowned Crane" },
        ],
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRegions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBirds,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => SUBREGION_BIRDS,
        });

      const result = await loadGameData();

      // aldfly/barswa (Alaska) and reccro (Hawaii) must NOT be in us-lower48
      expect(result.birds["us-lower48"].map((b) => b.id)).toEqual(["amerob"]);
    });

    it("should handle multiple virtual regions", async () => {
      const mockRegions = [
        { id: "us", name: "United States", country: "US" },
        US_LOWER48_REGION,
        {
          id: "us-northeast",
          name: "US Northeast",
          country: "US",
          parentRegion: "us",
          excludedSubregions: ["California", "Texas"],
        },
      ];
      const mockBirds = {
        us: [{ id: "amerob", name: "American Robin" }],
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRegions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBirds,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => SUBREGION_BIRDS,
        });

      const result = await loadGameData();

      // Both virtual regions get the parent list (no excluded ids in list)
      expect(result.birds["us-lower48"]).toEqual(mockBirds.us);
      expect(result.birds["us-northeast"]).toEqual(mockBirds.us);
      // Subregion file fetched only once (cached)
      expect(
        global.fetch.mock.calls.filter(([url]) =>
          url.includes("daily-subregion-birds.json"),
        ),
      ).toHaveLength(1);
    });

    it("should not override existing virtual region bird data", async () => {
      const mockRegions = [
        { id: "us", name: "United States", country: "US" },
        US_LOWER48_REGION,
      ];
      const mockBirds = {
        us: [{ id: "amerob", name: "American Robin" }],
        "us-lower48": [{ id: "barswa", name: "Barn Swallow" }], // Already has data
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRegions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBirds,
        });

      const result = await loadGameData();

      // Should keep existing us-lower48 data, not override with parent
      expect(result.birds["us-lower48"]).toEqual([
        { id: "barswa", name: "Barn Swallow" },
      ]);
      expect(result.birds["us-lower48"]).not.toEqual(mockBirds.us);
    });

    it("should handle virtual region with missing parent region", async () => {
      const mockRegions = [
        {
          id: "us-lower48",
          name: "US Lower 48",
          country: "US",
          parentRegion: "us", // Parent not in regions
          excludedSubregions: ["Alaska", "Hawaii"],
        },
      ];
      const mockBirds = {
        us: [{ id: "amerob", name: "American Robin" }],
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRegions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBirds,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => SUBREGION_BIRDS,
        });

      const result = await loadGameData();

      // Should still add virtual region data from birds.json
      expect(result.birds["us-lower48"]).toEqual(mockBirds.us);
    });

    it("should handle virtual region with missing parent bird data", async () => {
      const mockRegions = [
        { id: "us", name: "United States", country: "US" },
        {
          id: "us-lower48",
          name: "US Lower 48",
          country: "US",
          parentRegion: "us-missing", // Parent not in birds
          excludedSubregions: ["Alaska", "Hawaii"],
        },
      ];
      const mockBirds = {
        us: [{ id: "amerob", name: "American Robin" }],
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRegions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBirds,
        });

      const result = await loadGameData();

      // No parent data -> virtual region stays undefined
      expect(result.birds["us-lower48"]).toBeUndefined();
    });

    it("should not affect regions without parentRegion", async () => {
      const mockRegions = [
        { id: "us", name: "United States", country: "US" },
        { id: "eu", name: "Europe", country: "EU" },
      ];
      const mockBirds = {
        us: [{ id: "amerob", name: "American Robin" }],
        eu: [{ id: "barswa", name: "Barn Swallow" }],
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRegions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBirds,
        });

      const result = await loadGameData();

      // Should have both regions unchanged
      expect(result.birds.us).toEqual(mockBirds.us);
      expect(result.birds.eu).toEqual(mockBirds.eu);
    });

    it("should fall back to the parent list when the subregion fetch fails", async () => {
      vi.useFakeTimers();
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockRegions = [
        { id: "us", name: "United States", country: "US" },
        US_LOWER48_REGION,
      ];
      const mockBirds = {
        us: [{ id: "amerob", name: "American Robin" }],
      };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRegions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBirds,
        })
        .mockRejectedValue(new Error("Network error")); // subregion fetch fails

      const promise = loadGameData();
      // Retry backoff for the subregion file: 1000ms + 2000ms
      await vi.advanceTimersByTimeAsync(4000);
      const result = await promise;
      vi.useRealTimers();

      expect(result.birds["us-lower48"]).toEqual(mockBirds.us);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("Caching", () => {
    it("should use no-cache when forceRefresh is true", async () => {
      const mockRegions = [{ id: "us", name: "United States", country: "US" }];
      const mockBirds = { us: [] };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRegions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBirds,
        });

      await loadGameData(true);

      expect(global.fetch).toHaveBeenCalledWith(
        "/data/regions.json",
        expect.objectContaining({
          cache: "no-store",
          headers: expect.objectContaining({
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          }),
        }),
      );
    });

    it("should use default cache when forceRefresh is false", async () => {
      const mockRegions = [{ id: "us", name: "United States", country: "US" }];
      const mockBirds = { us: [] };

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockRegions,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockBirds,
        });

      await loadGameData(false);

      expect(global.fetch).toHaveBeenCalledWith(
        "/data/regions.json",
        expect.not.objectContaining({
          cache: "no-store",
        }),
      );
    });
  });

  describe("Error Handling", () => {
    it("should propagate fetch errors", async () => {
      global.fetch.mockRejectedValue(new Error("Network error"));

      await expect(loadGameData()).rejects.toThrow("Network error");
    });

    it("should propagate JSON parsing errors", async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => {
            throw new Error("Invalid JSON");
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      await expect(loadGameData()).rejects.toThrow("Invalid JSON");
    });
  });
});

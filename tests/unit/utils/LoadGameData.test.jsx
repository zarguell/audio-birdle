import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadGameData } from "@/utils/LoadGameData";

describe("LoadGameData", () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    global.fetch = vi.fn();
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
        {
          id: "us-lower48",
          name: "US Lower 48",
          country: "US",
          parentRegion: "us",
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

      // Should have us-lower48 birds copied from us
      expect(result.birds["us-lower48"]).toEqual(mockBirds.us);
      expect(result.birds["us-lower48"]).toBe(mockBirds.us); // Same reference
    });

    it("should handle multiple virtual regions", async () => {
      const mockRegions = [
        { id: "us", name: "United States", country: "US" },
        {
          id: "us-lower48",
          name: "US Lower 48",
          country: "US",
          parentRegion: "us",
          excludedSubregions: ["Alaska", "Hawaii"],
        },
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
        });

      const result = await loadGameData();

      // Both virtual regions should have parent bird data
      expect(result.birds["us-lower48"]).toEqual(mockBirds.us);
      expect(result.birds["us-northeast"]).toEqual(mockBirds.us);
    });

    it("should not override existing virtual region bird data", async () => {
      const mockRegions = [
        { id: "us", name: "United States", country: "US" },
        {
          id: "us-lower48",
          name: "US Lower 48",
          country: "US",
          parentRegion: "us",
          excludedSubregions: ["Alaska", "Hawaii"],
        },
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

      // Should have empty array for virtual region (undefined parent)
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

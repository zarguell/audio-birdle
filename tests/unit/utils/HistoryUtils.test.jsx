import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchWithRetry } from "@/utils/RetryUtils";
import {
  invalidateHistoryCache,
  loadHistoryData,
  getPastEntries,
  enrichHistoryEntries,
  pickHistoryClipUrl,
} from "@/utils/HistoryUtils";

vi.mock("@/utils/RetryUtils", () => ({
  fetchWithRetry: vi.fn(),
}));

const HISTORY = {
  us: [
    { date: "2026-08-20", id: "norcar", name: "Northern Cardinal", subregion: "Ohio" },
    { date: "2026-08-21", id: "amerob", name: "American Robin", subregion: "Iowa" },
    { date: "2026-08-22", id: "barswa", name: "Barn Swallow", subregion: "Maine" },
    // Today + future: must never appear in the archive
    { date: "2026-08-24", id: "today1", name: "Todays Bird", subregion: "Texas" },
    { date: "2026-08-25", id: "future1", name: "Tomorrows Bird", subregion: "Nevada" },
  ],
  "us-lower48": [
    { date: "2026-08-22", id: "barswa", name: "Barn Swallow", subregion: "Maine" },
  ],
};

const TODAY = "2026-08-24";

describe("HistoryUtils", () => {
  beforeEach(() => {
    invalidateHistoryCache();
    vi.clearAllMocks();
  });

  describe("loadHistoryData", () => {
    it("should fetch, parse and cache history.json", async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => HISTORY,
      });

      const data = await loadHistoryData();
      expect(data).toEqual(HISTORY);
      expect(fetchWithRetry).toHaveBeenCalledTimes(1);
      expect(fetchWithRetry).toHaveBeenCalledWith("/data/history.json");

      // Second call is served from the module cache
      const cached = await loadHistoryData();
      expect(cached).toBe(data);
      expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    });

    it("should refetch after invalidateHistoryCache", async () => {
      fetchWithRetry.mockResolvedValue({
        ok: true,
        json: async () => HISTORY,
      });

      await loadHistoryData();
      invalidateHistoryCache();
      await loadHistoryData();
      expect(fetchWithRetry).toHaveBeenCalledTimes(2);
    });

    it("should reject a non-object payload", async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => [1, 2, 3],
      });
      await expect(loadHistoryData()).rejects.toThrow(
        "Invalid history data format",
      );
    });
  });

  describe("getPastEntries", () => {
    it("should return strictly past entries, newest first", () => {
      const entries = getPastEntries(HISTORY, "us", TODAY);
      expect(entries.map((e) => e.date)).toEqual([
        "2026-08-22",
        "2026-08-21",
        "2026-08-20",
      ]);
    });

    it("should never include today's or future answers (spoiler guard)", () => {
      const entries = getPastEntries(HISTORY, "us", TODAY);
      const ids = entries.map((e) => e.id);
      expect(ids).not.toContain("today1");
      expect(ids).not.toContain("future1");
    });

    it("should return an empty list when the region is unknown", () => {
      expect(getPastEntries(HISTORY, "eu", TODAY)).toEqual([]);
    });

    it("should handle missing arguments and malformed entries", () => {
      expect(getPastEntries(null, "us", TODAY)).toEqual([]);
      expect(getPastEntries(HISTORY, "", TODAY)).toEqual([]);
      expect(getPastEntries(HISTORY, "us", "")).toEqual([]);
      expect(
        getPastEntries(
          { us: [{ noDate: true }, { date: "2026-08-01", id: "x" }, null] },
          "us",
          TODAY,
        ),
      ).toEqual([{ date: "2026-08-01", id: "x" }]);
    });
  });

  describe("enrichHistoryEntries", () => {
    const birds = [
      { id: "amerob", name: "American Robin", audioUrl: [{ url: "https://x.example/a.mp3", attribution: {} }] },
      { id: "barswa", name: "Barn Swallow", audioUrl: [{ url: "https://x.example/b.mp3" }, { url: "https://x.example/b2.mp3" }] },
    ];

    it("should attach matching bird records by id", () => {
      const entries = enrichHistoryEntries(
        [
          { date: "2026-08-21", id: "amerob" },
          { date: "2026-08-22", id: "barswa" },
        ],
        birds,
      );
      expect(entries[0].bird.name).toBe("American Robin");
      expect(entries[1].bird.id).toBe("barswa");
    });

    it("should keep a null bird for entries missing from the pool", () => {
      const entries = enrichHistoryEntries(
        [{ date: "2026-08-20", id: "gone1" }],
        birds,
      );
      expect(entries[0].bird).toBeNull();
    });

    it("should tolerate missing inputs", () => {
      expect(enrichHistoryEntries(null, birds)).toEqual([]);
      expect(enrichHistoryEntries([{ date: "d", id: "amerob" }], null)).toEqual([
        { date: "d", id: "amerob", bird: null },
      ]);
    });
  });

  describe("pickHistoryClipUrl", () => {
    it("should return an https URL from the bird's clips", () => {
      const entry = {
        date: "2026-08-21",
        id: "amerob",
        bird: { audioUrl: [{ url: "https://x.example/a.mp3" }] },
      };
      expect(pickHistoryClipUrl(entry)).toBe("https://x.example/a.mp3");
    });

    it("should return an empty string when there is no bird or clips", () => {
      expect(pickHistoryClipUrl({ bird: null })).toBe("");
      expect(pickHistoryClipUrl({ bird: { audioUrl: [] } })).toBe("");
      expect(pickHistoryClipUrl(undefined)).toBe("");
    });

    it("should refuse non-https clip URLs (defense in depth)", () => {
      const entry = {
        bird: { audioUrl: [{ url: "http://insecure.example/a.mp3" }] },
      };
      expect(pickHistoryClipUrl(entry)).toBe("");
    });
  });
});

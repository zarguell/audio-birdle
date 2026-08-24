import { describe, it, expect, vi, beforeEach } from "vitest";
import { setStorage, getStorage } from "@/utils/StorageUtils";
import {
  getVersionFromResponse,
  storeVersion,
  getCachedVersion,
  hasVersionChanged,
  checkDataFileUpdate,
  storeDataFileVersion,
} from "@/utils/versionUtils";

vi.mock("@/utils/StorageUtils", () => ({
  setStorage: vi.fn(),
  getStorage: vi.fn(),
}));

const makeHeaders = (init) => new Headers(init);

describe("versionUtils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getVersionFromResponse", () => {
    it("extracts Last-Modified and ETag from response headers", () => {
      const response = {
        headers: makeHeaders({
          "Last-Modified": "Wed, 05 Aug 2026 06:25:30 GMT",
          ETag: '"abc123"',
        }),
      };

      expect(getVersionFromResponse(response)).toEqual({
        lastModified: "Wed, 05 Aug 2026 06:25:30 GMT",
        etag: '"abc123"',
      });
    });

    it("returns nulls when headers are missing", () => {
      expect(getVersionFromResponse({})).toEqual({
        lastModified: null,
        etag: null,
      });
    });

    it("returns nulls when header values are absent", () => {
      const response = { headers: makeHeaders({}) };

      expect(getVersionFromResponse(response)).toEqual({
        lastModified: null,
        etag: null,
      });
    });
  });

  describe("storeVersion", () => {
    it("stores both values when present", () => {
      storeVersion(
        { lastModified: "lm-1", etag: "etag-1" },
        "lm-key",
        "etag-key",
      );

      expect(setStorage).toHaveBeenCalledWith("lm-key", "lm-1");
      expect(setStorage).toHaveBeenCalledWith("etag-key", "etag-1");
    });

    it("skips absent values", () => {
      storeVersion({ lastModified: "lm-1" }, "lm-key", "etag-key");

      expect(setStorage).toHaveBeenCalledWith("lm-key", "lm-1");
      expect(setStorage).not.toHaveBeenCalledWith(
        "etag-key",
        expect.anything(),
      );
    });

    it("does nothing for an empty version object", () => {
      storeVersion({}, "lm-key", "etag-key");

      expect(setStorage).not.toHaveBeenCalled();
    });
  });

  describe("getCachedVersion", () => {
    it("reads both keys from storage", () => {
      getStorage
        .mockReturnValueOnce("cached-lm")
        .mockReturnValueOnce("cached-etag");

      const cached = getCachedVersion("lm-key", "etag-key");

      expect(cached).toEqual({
        lastModified: "cached-lm",
        etag: "cached-etag",
      });
      expect(getStorage).toHaveBeenCalledWith("lm-key", null);
      expect(getStorage).toHaveBeenCalledWith("etag-key", null);
    });

    it("returns nulls when nothing is cached", () => {
      getStorage.mockReturnValue(null);

      expect(getCachedVersion("lm-key", "etag-key")).toEqual({
        lastModified: null,
        etag: null,
      });
    });
  });

  describe("hasVersionChanged", () => {
    it("is true when lastModified differs", () => {
      expect(
        hasVersionChanged(
          { lastModified: "new", etag: null },
          { lastModified: "old", etag: null },
        ),
      ).toBe(true);
    });

    it("is true when etag differs", () => {
      expect(
        hasVersionChanged(
          { lastModified: null, etag: '"new"' },
          { lastModified: null, etag: '"old"' },
        ),
      ).toBe(true);
    });

    it("is false when versions match", () => {
      expect(
        hasVersionChanged(
          { lastModified: "same", etag: '"same"' },
          { lastModified: "same", etag: '"same"' },
        ),
      ).toBe(false);
    });

    it("is false when the server advertises no version info", () => {
      // The implementation short-circuits to `null` (falsy) here rather than
      // returning a literal false; assert falsiness, which is what callers rely on.
      expect(
        hasVersionChanged(
          { lastModified: null, etag: null },
          { lastModified: "old", etag: '"old"' },
        ),
      ).toBeFalsy();
    });
  });

  describe("checkDataFileUpdate", () => {
    it("reports no update when server and cached versions match", async () => {
      global.fetch.mockResolvedValue({
        headers: makeHeaders({
          "Last-Modified": "same-lm",
          ETag: '"same-etag"',
        }),
      });
      // getCachedVersion reads lastModified first, then etag
      getStorage
        .mockReturnValueOnce("same-lm")
        .mockReturnValueOnce('"same-etag"');

      const result = await checkDataFileUpdate(
        "https://example.com/birds.json",
        "lm-key",
        "etag-key",
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/^https:\/\/example\.com\/birds\.json\?t=/),
        { method: "HEAD", cache: "no-store" },
      );
      expect(result).toEqual({
        hasUpdate: false,
        serverVersion: "same-lm",
        cachedVersion: "same-lm",
      });
    });

    it("reports an update when versions differ", async () => {
      global.fetch.mockResolvedValue({
        headers: makeHeaders({ ETag: '"server-etag"' }),
      });
      getStorage.mockReturnValue(null);

      const result = await checkDataFileUpdate(
        "https://example.com/birds.json",
        "lm-key",
        "etag-key",
      );

      expect(result.hasUpdate).toBe(true);
      expect(result.serverVersion).toBe('"server-etag"');
      expect(result.cachedVersion).toBeNull();
    });

    it("returns hasUpdate false and warns on fetch failure", async () => {
      global.fetch.mockRejectedValue(new Error("Network down"));
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const result = await checkDataFileUpdate(
        "https://example.com/birds.json",
        "lm-key",
        "etag-key",
      );

      expect(result).toEqual({ hasUpdate: false });
      expect(warnSpy).toHaveBeenCalledWith(
        "Failed to check https://example.com/birds.json for updates:",
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  describe("storeDataFileVersion", () => {
    it("extracts version info from the response and stores it", () => {
      const response = {
        headers: makeHeaders({
          "Last-Modified": "lm-value",
          ETag: '"etag-value"',
        }),
      };

      storeDataFileVersion(response, "lm-key", "etag-key");

      expect(setStorage).toHaveBeenCalledWith("lm-key", "lm-value");
      expect(setStorage).toHaveBeenCalledWith("etag-key", '"etag-value"');
    });

    it("stores nothing when the response carries no headers", () => {
      storeDataFileVersion({}, "lm-key", "etag-key");

      expect(setStorage).not.toHaveBeenCalled();
    });
  });
});

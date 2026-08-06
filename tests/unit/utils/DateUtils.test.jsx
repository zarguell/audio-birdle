import { describe, it, expect, vi, afterEach } from "vitest";
import { getTodayString, formatDateForDisplay } from "@/utils/DateUtils";

describe("DateUtils", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getTodayString", () => {
    it("should return YYYY-MM-DD format", () => {
      expect(getTodayString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should match the current LOCAL date", () => {
      const now = new Date();
      const expected = `${now.getFullYear()}-${String(
        now.getMonth() + 1,
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      expect(getTodayString()).toBe(expected);
    });
  });

  describe("formatDateForDisplay", () => {
    it("should format YYYY-MM-DD as a readable date preserving the LOCAL date", () => {
      const expected = new Date(2025, 11, 27).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      expect(formatDateForDisplay("2025-12-27")).toBe(expected);
    });

    it("should preserve the day of the date string exactly (no TZ shift)", () => {
      // 2026-01-01 formatted must reference Jan 1 local, not Dec 31/Jan 2
      const formatted = formatDateForDisplay("2026-01-01");
      expect(formatted).toContain("1");
      expect(formatted).not.toContain("December");
      expect(formatted).not.toContain("2,");
    });
  });
});

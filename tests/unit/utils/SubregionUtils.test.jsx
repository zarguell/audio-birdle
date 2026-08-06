import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSubregion, SubregionDisplay } from "@/utils/SubregionUtils";
import { loadDailyBirdData } from "@/utils/DailyBirdUtils";
import { fetchWithRetry } from "@/utils/RetryUtils";

// Mock the daily loader — useSubregion must go through the cached loader
// instead of fetching daily.json itself.
vi.mock("@/utils/DailyBirdUtils", () => ({
  loadDailyBirdData: vi.fn(),
}));

vi.mock("@/utils/RetryUtils", () => ({
  fetchWithRetry: vi.fn(),
}));

describe("useSubregion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should load the subregion via loadDailyBirdData (cached loader)", async () => {
    loadDailyBirdData.mockResolvedValue([
      {
        date: "2026-08-06",
        region: "us",
        answerHash: "abc",
        subregion: "New York",
      },
      {
        date: "2026-08-05",
        region: "us",
        answerHash: "def",
        subregion: "South Dakota",
      },
    ]);

    const { result } = renderHook(() => useSubregion("us", "2026-08-06"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subregion).toBe("New York");
    // Must NOT fetch daily.json directly — the loader is cached
    expect(fetchWithRetry).not.toHaveBeenCalledWith(
      "/data/daily.json",
      expect.anything(),
    );
    expect(fetchWithRetry).not.toHaveBeenCalled();
  });

  it("should leave subregion empty when no entry matches today", async () => {
    loadDailyBirdData.mockResolvedValue([
      {
        date: "2026-08-05",
        region: "us",
        answerHash: "def",
        subregion: "South Dakota",
      },
    ]);

    const { result } = renderHook(() => useSubregion("us", "2026-08-06"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subregion).toBe("");
  });

  it("should handle loader failures gracefully", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    loadDailyBirdData.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useSubregion("us", "2026-08-06"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.subregion).toBe("");
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("should refetch when region or today changes", async () => {
    loadDailyBirdData.mockResolvedValue([
      {
        date: "2026-08-06",
        region: "us",
        answerHash: "abc",
        subregion: "New York",
      },
      {
        date: "2026-08-06",
        region: "eu",
        answerHash: "xyz",
        subregion: "Bavaria",
      },
    ]);

    const { result, rerender } = renderHook(
      ({ region, today }) => useSubregion(region, today),
      { initialProps: { region: "us", today: "2026-08-06" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subregion).toBe("New York");

    rerender({ region: "eu", today: "2026-08-06" });

    await waitFor(() => expect(result.current.subregion).toBe("Bavaria"));
    expect(loadDailyBirdData).toHaveBeenCalledTimes(2);
  });
});

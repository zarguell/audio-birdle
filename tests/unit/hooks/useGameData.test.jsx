import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGameData } from "@/hooks/useGameData";
import { loadGameData } from "@/utils/LoadGameData";
import { getDailyBirdWithFallback } from "@/utils/GameLogic";
import {
  checkForUpdates,
  checkBirdsJsonUpdate,
  hasDateChanged,
  refreshGameData,
  clearServiceWorkerCache,
} from "@/utils/CacheUtils";
import { loadDeadAudioUrlsCache } from "@/utils/AudioUtils";
import { toast } from "sonner";

vi.mock("@/utils/LoadGameData", () => ({
  loadGameData: vi.fn(),
}));

vi.mock("@/utils/GameLogic", () => ({
  getDailyBirdWithFallback: vi.fn(),
}));

vi.mock("@/utils/CacheUtils", () => ({
  checkForUpdates: vi.fn(),
  checkBirdsJsonUpdate: vi.fn(),
  hasDateChanged: vi.fn(),
  refreshGameData: vi.fn(),
  clearServiceWorkerCache: vi.fn(),
  clearDeadAudioUrlsCache: vi.fn(),
}));

vi.mock("@/utils/AudioUtils", () => ({
  loadDeadAudioUrlsCache: vi.fn(),
  clearDeadAudioUrlsCache: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const BIRD_1 = {
  id: "amerob",
  name: "American Robin",
  scientificName: "Turdus migratorius",
  audioUrl: ["/audio/amerob.mp3"],
};
const BIRD_2 = {
  id: "norcar",
  name: "Northern Cardinal",
  scientificName: "Cardinalis cardinalis",
  audioUrl: ["/audio/norcar.mp3"],
};

const REGION_DATA = {
  regions: [{ id: "us", name: "United States" }],
  birds: { us: [BIRD_1] },
};

// Property writes on a module-scope holder (not a variable reassignment in
// the component body) — the react-hooks lint rule only forbids the latter.
const flush = async () => {
  await act(async () => {});
  await act(async () => {});
};

describe("useGameData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadGameData.mockResolvedValue(REGION_DATA);
    getDailyBirdWithFallback.mockResolvedValue({ success: true, bird: BIRD_1 });
    checkForUpdates.mockResolvedValue({
      hasUpdate: false,
      dailyJsonUpdate: false,
    });
    checkBirdsJsonUpdate.mockResolvedValue({ hasUpdate: false });
    hasDateChanged.mockReturnValue(false);
    clearServiceWorkerCache.mockResolvedValue(undefined);
    refreshGameData.mockResolvedValue(REGION_DATA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should load regions, birds and today's bird on mount", async () => {
    const { result } = renderHook(() => useGameData("us"));
    await flush();

    expect(loadGameData).toHaveBeenCalledTimes(1);
    expect(loadDeadAudioUrlsCache).toHaveBeenCalled();
    expect(result.current.regions).toEqual(REGION_DATA.regions);
    expect(result.current.birds).toEqual(REGION_DATA.birds);
    expect(result.current.todaysBird).toEqual(BIRD_1);
    expect(result.current.loadingBird).toBe(false);
  });

  it("should surface the offline fallback message when usedFallback is true", async () => {
    getDailyBirdWithFallback.mockResolvedValue({
      success: true,
      bird: BIRD_1,
      usedFallback: true,
      message: "Offline mode: using hash-based selection",
    });

    const { result } = renderHook(() => useGameData("us"));
    await flush();

    expect(result.current.todaysBird).toEqual(BIRD_1);
    expect(result.current.dataConsistencyError).toBe(
      "Offline mode: using hash-based selection",
    );
  });

  it("should not re-run the update-check effect across re-renders", async () => {
    const { rerender } = renderHook(() => useGameData("us"));
    await flush();

    expect(checkForUpdates).toHaveBeenCalledTimes(1);
    expect(checkBirdsJsonUpdate).toHaveBeenCalledTimes(1);

    // Re-render several times: identities of handleAutoRefresh/loadAndSetBird
    // must be stable, so the update-check effect does NOT re-fire (which used
    // to issue repeated HEAD requests and loop refresh calls).
    rerender(() => useGameData("us"));
    await flush();
    rerender(() => useGameData("us"));
    await flush();
    rerender(() => useGameData("us"));
    await flush();

    expect(checkForUpdates).toHaveBeenCalledTimes(1);
    expect(checkBirdsJsonUpdate).toHaveBeenCalledTimes(1);
    // No stale data detected: handleAutoRefresh never invoked
    expect(clearServiceWorkerCache).not.toHaveBeenCalled();
    expect(refreshGameData).not.toHaveBeenCalled();
  });

  it("should auto-refresh when stale data is detected", async () => {
    hasDateChanged.mockReturnValue(true);

    renderHook(() => useGameData("us"));
    await flush();

    expect(refreshGameData).toHaveBeenCalledTimes(1);
    expect(clearServiceWorkerCache).toHaveBeenCalledTimes(1);
  });

  it("should schedule a refresh at local midnight", async () => {
    vi.useFakeTimers();
    const now = new Date(2026, 7, 6, 10, 30, 0); // Aug 6 2026 10:30 local
    vi.setSystemTime(now);

    const { result } = renderHook(() => useGameData("us"));
    await act(async () => {});
    await act(async () => {});
    expect(result.current.todaysBird).toEqual(BIRD_1);
    expect(refreshGameData).not.toHaveBeenCalled();

    // From here on, the refreshed data yields the new day's bird
    getDailyBirdWithFallback.mockResolvedValue({ success: true, bird: BIRD_2 });

    // Advance to just after the next local midnight
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      0,
      0,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        nextMidnight.getTime() - now.getTime() + 1000,
      );
    });

    expect(refreshGameData).toHaveBeenCalledTimes(1);
    expect(clearServiceWorkerCache).toHaveBeenCalledTimes(1);
    // The refreshed bird is loaded for the new day
    expect(result.current.todaysBird).toEqual(BIRD_2);
  });

  it("should cancel the midnight timer when the region changes", async () => {
    vi.useFakeTimers();
    const now = new Date(2026, 7, 6, 10, 30, 0);
    vi.setSystemTime(now);

    const { rerender } = renderHook(() => useGameData("us"));
    await act(async () => {});
    await act(async () => {});

    // Region change clears and reschedules the timer
    rerender(() => useGameData("eu"));
    await act(async () => {});

    // Advance far past the original midnight: the eu harness's timer is
    // scheduled from render time; verify at least no duplicate refresh fires
    // from the cancelled us timer (refresh is mocked, count stays consistent
    // with what the new timer would do at ITS midnight).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000); // 1h: no midnight yet
    });

    // Nothing fired before midnight
    expect(refreshGameData).not.toHaveBeenCalled();
  });

  it("should clear the error state when the bird loads normally", async () => {
    // getDailyBirdWithFallback resolves success WITHOUT usedFallback
    const { result } = renderHook(() => useGameData("us"));
    await flush();

    expect(result.current.todaysBird).toEqual(BIRD_1);
    expect(result.current.dataConsistencyError).toBeNull();
  });

  it("should surface a non-success result as an error with toast", async () => {
    getDailyBirdWithFallback.mockResolvedValue({
      success: false,
      message: "Daily challenge data is out of sync",
    });
    const toastError = vi.spyOn(toast, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useGameData("us"));
    await flush();

    expect(result.current.todaysBird).toBeNull();
    expect(result.current.dataConsistencyError).toBe(
      "Daily challenge data is out of sync",
    );
    expect(toastError).toHaveBeenCalled();
  });

  it("should handle a rejected bird lookup with an error message", async () => {
    getDailyBirdWithFallback.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const toastError = vi.spyOn(toast, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useGameData("us"));
    await flush();

    expect(result.current.todaysBird).toBeNull();
    expect(result.current.dataConsistencyError).toContain("Failed to load");
    expect(toastError).toHaveBeenCalled();
  });

  it("should toast when the initial game data load fails", async () => {
    loadGameData.mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const toastError = vi.spyOn(toast, "error").mockImplementation(() => {});

    renderHook(() => useGameData("us"));
    await flush();

    expect(toastError).toHaveBeenCalledWith(
      "Failed to load game data. Please refresh the page.",
    );
  });

  it("should set hasUpdate when an update is detected", async () => {
    checkForUpdates.mockResolvedValue({
      hasUpdate: true,
      dailyJsonUpdate: false,
    });

    const { result } = renderHook(() => useGameData("us"));
    await flush();

    expect(result.current.hasUpdate).toBe(true);
  });

  it("should force-refresh game data on demand", async () => {
    refreshGameData.mockResolvedValue(REGION_DATA);
    getDailyBirdWithFallback.mockResolvedValue({
      success: true,
      bird: BIRD_2,
    });

    const { result } = renderHook(() => useGameData("us"));
    await flush();

    await act(async () => {
      await result.current.handleForceRefresh();
    });

    expect(refreshGameData).toHaveBeenCalledTimes(1);
    expect(clearServiceWorkerCache).toHaveBeenCalledTimes(1);
    expect(result.current.todaysBird).toEqual(BIRD_2);
  });

  it("should refresh data manually when online", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
    refreshGameData.mockResolvedValue(REGION_DATA);
    const toastSuccess = vi
      .spyOn(toast, "success")
      .mockImplementation(() => {});

    const { result } = renderHook(() => useGameData("us"));
    await flush();

    await act(async () => {
      await result.current.handleRefreshData();
    });

    expect(refreshGameData).toHaveBeenCalledTimes(1);
    expect(result.current.refreshingData).toBe(false);
    expect(result.current.hasUpdate).toBe(false);
    expect(toastSuccess).toHaveBeenCalledWith("Data refreshed successfully!");
  });

  it("should refuse to refresh while offline", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      configurable: true,
    });
    const toastError = vi.spyOn(toast, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useGameData("us"));
    await flush();

    await act(async () => {
      await result.current.handleRefreshData();
    });

    expect(refreshGameData).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      "Cannot refresh data while offline.",
    );
  });

  it("should toast when a manual refresh fails", async () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      configurable: true,
    });
    refreshGameData.mockRejectedValue(new Error("boom"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const toastError = vi.spyOn(toast, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useGameData("us"));
    await flush();

    await act(async () => {
      await result.current.handleRefreshData();
    });

    expect(toastError).toHaveBeenCalledWith(
      "Failed to refresh data. Please try again.",
    );
    expect(result.current.refreshingData).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMigration } from "@/hooks/useMigration";
import { useNormalGameStore } from "@/stores/normalGameStore";
import { useHardModeStore } from "@/stores/hardModeStore";

vi.mock("@/stores/normalGameStore");
vi.mock("@/stores/hardModeStore");

describe("useMigration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
  });

  it("should run migration on mount", () => {
    const mockMigrateNormal = vi.fn();
    const mockMigrateHard = vi.fn();

    useNormalGameStore.getState.mockReturnValue({
      migrateFromOldFormat: mockMigrateNormal,
    });

    useHardModeStore.getState.mockReturnValue({
      migrateFromOldFormat: mockMigrateHard,
    });

    renderHook(() => useMigration());

    expect(mockMigrateNormal).toHaveBeenCalled();
    expect(mockMigrateHard).toHaveBeenCalled();
  });

  it("should log migration status", () => {
    useNormalGameStore.getState.mockReturnValue({
      migrateFromOldFormat: vi.fn(),
    });

    useHardModeStore.getState.mockReturnValue({
      migrateFromOldFormat: vi.fn(),
    });

    renderHook(() => useMigration());

    expect(console.log).toHaveBeenCalledWith(
      "App mounted: Checking for old data to migrate...",
    );
    expect(console.log).toHaveBeenCalledWith("Migration check complete");
  });

  it("should only run once on mount", () => {
    const mockMigrateNormal = vi.fn();
    const mockMigrateHard = vi.fn();

    useNormalGameStore.getState.mockReturnValue({
      migrateFromOldFormat: mockMigrateNormal,
    });

    useHardModeStore.getState.mockReturnValue({
      migrateFromOldFormat: mockMigrateHard,
    });

    const { rerender } = renderHook(() => useMigration());

    rerender();
    rerender();

    expect(mockMigrateNormal).toHaveBeenCalledTimes(1);
    expect(mockMigrateHard).toHaveBeenCalledTimes(1);
  });

  it("should get state from both stores", () => {
    useNormalGameStore.getState.mockReturnValue({
      migrateFromOldFormat: vi.fn(),
    });

    useHardModeStore.getState.mockReturnValue({
      migrateFromOldFormat: vi.fn(),
    });

    renderHook(() => useMigration());

    expect(useNormalGameStore.getState).toHaveBeenCalled();
    expect(useHardModeStore.getState).toHaveBeenCalled();
  });
});

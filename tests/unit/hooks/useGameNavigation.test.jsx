import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGameNavigation } from "@/hooks/useGameNavigation";
import { VIEWS } from "@/utils/Constants";

describe("useGameNavigation", () => {
  it("should initialize with default view", () => {
    const { result } = renderHook(() => useGameNavigation());

    expect(result.current.currentView).toBe(VIEWS.MODE_SELECTOR);
  });

  it("should allow changing currentView via setCurrentView", () => {
    const { result } = renderHook(() => useGameNavigation());

    const { setCurrentView } = result.current;

    act(() => {
      setCurrentView(VIEWS.GAME);
    });

    expect(result.current.currentView).toBe(VIEWS.GAME);
  });

  it("should expose VIEWS constant", () => {
    const { result } = renderHook(() => useGameNavigation());

    expect(result.current.VIEWS).toBeDefined();
    expect(result.current.VIEWS.MODE_SELECTOR).toBeDefined();
    expect(result.current.VIEWS.GAME).toBeDefined();
    expect(result.current.VIEWS.HARD_MODE).toBeDefined();
    expect(result.current.VIEWS.PRACTICE).toBeDefined();
    expect(result.current.VIEWS.SETTINGS).toBeDefined();
    expect(result.current.VIEWS.STATS).toBeDefined();
  });

  it("should support custom initial view", () => {
    const { result } = renderHook(() => useGameNavigation(VIEWS.SETTINGS));

    expect(result.current.currentView).toBe(VIEWS.SETTINGS);
  });
});

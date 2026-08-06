/**
 * App smoke test.
 *
 * Renders <AudioBirdle /> with the data hooks and game store mocked, then
 * walks the main navigation flow (region -> mode -> game/settings/stats) and
 * asserts the app never crashes on mount and shows the expected views.
 * Assertions are deliberately structure-level so they survive unrelated
 * runtime changes in the underlying views.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AudioBirdle from "@/App";

const mockRegions = [
  { id: "us", name: "United States" },
  { id: "eu", name: "Europe" },
];

const mockPersistenceState = {
  selectedRegion: null,
  lastPlayedMode: "normal",
};

vi.mock("@/hooks/usePersistence", () => ({
  usePersistence: () => ({
    selectedRegion: mockPersistenceState.selectedRegion,
    setSelectedRegion: (region) => {
      mockPersistenceState.selectedRegion = region;
    },
    lastPlayedMode: mockPersistenceState.lastPlayedMode,
    setLastPlayedMode: (mode) => {
      mockPersistenceState.lastPlayedMode = mode;
    },
  }),
}));

vi.mock("@/hooks/useGameData", () => ({
  useGameData: () => ({
    regions: mockRegions,
    birds: { us: [], eu: [] },
    todaysBird: null,
    dataConsistencyError: null,
    hasUpdate: false,
    refreshingData: false,
    handleForceRefresh: vi.fn(),
    handleRefreshData: vi.fn(),
  }),
}));

vi.mock("@/components/GameView", () => ({
  // GameView is mocked out of the smoke test: it is not part of the coverage
  // include list, and it has its own dedicated render regression test
  // (tests/unit/components/GameView.test.jsx). Mocking keeps this smoke test
  // focused on App.jsx and its navigation flow.
  default: ({ onBack }) => (
    <div data-testid="game-view">
      <button type="button" onClick={onBack}>
        Mock Back
      </button>
    </div>
  ),
}));

const mockStoreState = {
  dailyGames: {},
  stats: {
    totalGamesPlayed: 0,
    totalGamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    regionStats: {},
  },
  getDailyGame: vi.fn(() => undefined),
  setDailyGame: vi.fn(),
  processGuess: vi.fn(),
  updateStats: vi.fn(),
  reset: vi.fn(),
  migrateFromOldStores: vi.fn(),
};

vi.mock("@/stores/gameStore", () => ({
  useGameStore: Object.assign((selector) => selector(mockStoreState), {
    getState: () => mockStoreState,
  }),
}));

describe("AudioBirdle smoke test", () => {
  beforeEach(() => {
    mockPersistenceState.selectedRegion = null;
    mockPersistenceState.lastPlayedMode = "normal";
    // Settings' "Reset All Data" action is guarded by a window.confirm prompt;
    // accept it so the reset path is actually exercised.
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true),
    );
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the region selector as the initial view", () => {
    render(<AudioBirdle />);

    expect(
      screen.getByRole("heading", { name: /Select Your Region/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /United States/i }),
    ).toBeInTheDocument();
  });

  it("walks the full navigation flow without crashing", () => {
    const { rerender } = render(<AudioBirdle />);

    // 1. Region selector -> pick a region
    fireEvent.click(screen.getByRole("button", { name: /United States/i }));
    rerender(<AudioBirdle />);

    expect(
      screen.getByRole("heading", { name: /Select Game Mode/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Normal Mode/i }),
    ).toBeInTheDocument();

    // 2. Mode selector -> Settings
    fireEvent.click(screen.getByRole("button", { name: /^Settings$/i }));
    expect(
      screen.getByRole("heading", { name: /Settings/i }),
    ).toBeInTheDocument();

    // Exercise the Settings actions wired to the game store / refresh callback
    fireEvent.click(
      screen.getByRole("button", { name: /Reset Today's Game/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Reset All Data/i }));
    fireEvent.click(screen.getByRole("button", { name: /Refresh Game Data/i }));
    expect(mockStoreState.setDailyGame).toHaveBeenCalled();
    expect(mockStoreState.reset).toHaveBeenCalled();

    // 3. Settings -> Stats
    fireEvent.click(screen.getByRole("button", { name: /View Stats/i }));
    expect(
      screen.getByRole("heading", { name: /Your Stats/i }),
    ).toBeInTheDocument();

    // 4. Stats -> back to Settings
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(
      screen.getByRole("heading", { name: /Settings/i }),
    ).toBeInTheDocument();

    // 5. Settings -> back to Mode selector
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(
      screen.getByRole("heading", { name: /Select Game Mode/i }),
    ).toBeInTheDocument();

    // 6. Normal mode game view (GameView mocked)
    fireEvent.click(screen.getByRole("button", { name: /Normal Mode/i }));
    expect(screen.getByTestId("game-view")).toBeInTheDocument();

    // 7. Back to Mode selector
    fireEvent.click(screen.getByRole("button", { name: /Mock Back/i }));
    expect(
      screen.getByRole("heading", { name: /Select Game Mode/i }),
    ).toBeInTheDocument();

    // 8. Practice mode (GameView mocked)
    fireEvent.click(screen.getByRole("button", { name: /Practice Mode/i }));
    expect(screen.getByTestId("game-view")).toBeInTheDocument();

    // 9. Back from practice
    fireEvent.click(screen.getByRole("button", { name: /Mock Back/i }));
    expect(
      screen.getByRole("heading", { name: /Select Game Mode/i }),
    ).toBeInTheDocument();

    // 10. Hard mode game view (GameView mocked)
    fireEvent.click(screen.getByRole("button", { name: /Hard Mode/i }));
    expect(screen.getByTestId("game-view")).toBeInTheDocument();
  });

  it("shows the region selector again after changing region", () => {
    const { rerender } = render(<AudioBirdle />);

    fireEvent.click(screen.getByRole("button", { name: /United States/i }));
    rerender(<AudioBirdle />);

    fireEvent.click(screen.getByRole("button", { name: /^Settings$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Change Region/i }));
    rerender(<AudioBirdle />);

    expect(
      screen.getByRole("heading", { name: /Select Your Region/i }),
    ).toBeInTheDocument();
  });
});

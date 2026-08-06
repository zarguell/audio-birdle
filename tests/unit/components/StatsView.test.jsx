import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StatsView from "@/components/StatsView";

const REGIONS = [
  { id: "us", name: "United States" },
  { id: "eu", name: "Europe" },
];

const STATS = {
  totalGamesPlayed: 10,
  totalGamesWon: 6,
  currentStreak: 2,
  maxStreak: 5,
  regionStats: {
    us: { gamesPlayed: 6, gamesWon: 4, totalGuesses: 18, averageGuesses: 3 },
    eu: { gamesPlayed: 4, gamesWon: 2, totalGuesses: 14, averageGuesses: 3.5 },
  },
};

describe("StatsView", () => {
  it("should render overall performance numbers", () => {
    render(<StatsView stats={STATS} regions={REGIONS} onBack={vi.fn()} />);

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("60.0%")).toBeInTheDocument();
    // Global average computed from per-region totals: 32 guesses / 10 games
    expect(screen.getByText("3.2")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("should render the per-region breakdown", () => {
    render(<StatsView stats={STATS} regions={REGIONS} onBack={vi.fn()} />);

    expect(screen.getByText("United States")).toBeInTheDocument();
    expect(screen.getByText("6 games")).toBeInTheDocument();
    expect(screen.getByText("Win Rate: 66.7%")).toBeInTheDocument();
    expect(screen.getByText("Avg: 3.0 guesses")).toBeInTheDocument();

    expect(screen.getByText("Europe")).toBeInTheDocument();
    expect(screen.getByText("4 games")).toBeInTheDocument();
    expect(screen.getByText("Win Rate: 50.0%")).toBeInTheDocument();
    expect(screen.getByText("Avg: 3.5 guesses")).toBeInTheDocument();
  });

  it("should handle undefined stats (initial load)", () => {
    render(<StatsView stats={undefined} regions={REGIONS} onBack={vi.fn()} />);

    // games played, avg guesses and best streak all fall back to 0
    expect(screen.getAllByText("0")).toHaveLength(3);
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("No games played yet!")).toBeInTheDocument();
  });

  it("should call onBack when back is pressed", () => {
    const onBack = vi.fn();
    render(<StatsView stats={STATS} regions={REGIONS} onBack={onBack} />);

    fireEvent.click(screen.getByText("← Back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("should not crash with empty regionStats", () => {
    const emptyStats = {
      totalGamesPlayed: 0,
      totalGamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      regionStats: {},
    };
    render(<StatsView stats={emptyStats} regions={REGIONS} onBack={vi.fn()} />);

    expect(screen.getByText("No games played yet!")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RegionSelector from '@/components/RegionSelector';

const { storeState } = vi.hoisted(() => ({
  storeState: { dailyGames: {} },
}));

vi.mock('@/stores/gameStore', () => ({
  useGameStore: (selector) => selector(storeState),
}));

const REGIONS = [
  { id: 'us', name: 'United States' },
  { id: 'eu', name: 'Europe' },
];

describe('RegionSelector', () => {
  it('renders all regions and calls onRegionSelect on click', () => {
    const onRegionSelect = vi.fn();
    render(
      <RegionSelector
        regions={REGIONS}
        today="2026-08-06"
        onRegionSelect={onRegionSelect}
      />,
    );

    expect(screen.getByText('United States')).toBeInTheDocument();
    expect(screen.getByText('Europe')).toBeInTheDocument();

    fireEvent.click(screen.getByText('United States'));
    expect(onRegionSelect).toHaveBeenCalledWith('us');
  });

  it('shows "Played Today" when a normal game has guesses today', () => {
    storeState.dailyGames = {
      'us-2026-08-06-normal': { guesses: [{ birdId: 'amerob' }] },
    };
    render(
      <RegionSelector
        regions={REGIONS}
        today="2026-08-06"
        onRegionSelect={() => {}}
      />,
    );

    expect(screen.getByText('Played Today')).toBeInTheDocument();
  });

  it('shows "Played Today" for a hard-mode game today', () => {
    storeState.dailyGames = {
      'us-2026-08-06-hard': { guesses: [{ birdId: 'amerob' }] },
    };
    render(
      <RegionSelector
        regions={REGIONS}
        today="2026-08-06"
        onRegionSelect={() => {}}
      />,
    );

    expect(screen.getByText('Played Today')).toBeInTheDocument();
  });

  it('does not show the badge when no game has guesses today', () => {
    storeState.dailyGames = {
      'us-2026-08-05-normal': { guesses: [{ birdId: 'amerob' }] },
      'eu-2026-08-06-normal': { guesses: [] },
    };
    render(
      <RegionSelector
        regions={REGIONS}
        today="2026-08-06"
        onRegionSelect={() => {}}
      />,
    );

    expect(screen.queryByText('Played Today')).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ModeSelector from '@/components/ModeSelector';
import { VIEWS } from '@/utils/Constants';

const GAME_MODES = [
  {
    mode: 'normal',
    name: 'Normal Mode',
    description: '4 options, 4 guesses',
    icon: '🎯',
    color: 'blue',
    view: 'normal',
  },
  {
    mode: 'hard',
    name: 'Hard Mode',
    description: 'Type your guess',
    icon: '🧠',
    color: 'red',
    view: 'hard',
  },
];

const DEFAULT_PROPS = {
  gameModes: GAME_MODES,
  onModeSelect: vi.fn(),
  lastPlayedMode: null,
  selectedRegion: 'us',
  regions: [{ id: 'us', name: 'United States' }],
  normalCompleted: false,
  hardCompleted: false,
};

describe('ModeSelector', () => {
  it('renders all game modes and settings', () => {
    render(<ModeSelector {...DEFAULT_PROPS} />);

    expect(screen.getByText('Normal Mode')).toBeInTheDocument();
    expect(screen.getByText('Hard Mode')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('calls onModeSelect with view and mode when a mode is clicked', () => {
    const onModeSelect = vi.fn();
    render(<ModeSelector {...DEFAULT_PROPS} onModeSelect={onModeSelect} />);

    fireEvent.click(screen.getByText('Normal Mode'));
    expect(onModeSelect).toHaveBeenCalledWith('normal', 'normal');
  });

  it('calls onModeSelect with VIEWS.SETTINGS from the settings button', () => {
    const onModeSelect = vi.fn();
    render(<ModeSelector {...DEFAULT_PROPS} onModeSelect={onModeSelect} />);

    fireEvent.click(screen.getByText('Settings'));
    expect(onModeSelect).toHaveBeenCalledWith(VIEWS.SETTINGS);
  });

  it('disables the other mode once one is completed', () => {
    render(<ModeSelector {...DEFAULT_PROPS} normalCompleted={true} />);

    const hardButton = screen.getByText('Hard Mode').closest('button');
    expect(hardButton).toBeDisabled();
    expect(screen.getByText('Other mode played')).toBeInTheDocument();
  });

  it('marks the last played mode', () => {
    render(<ModeSelector {...DEFAULT_PROPS} lastPlayedMode="hard" />);

    expect(screen.getByText('Last played')).toBeInTheDocument();
  });
});

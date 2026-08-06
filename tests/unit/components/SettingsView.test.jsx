import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsView from '@/components/SettingsView';

const DEFAULT_PROPS = {
  selectedRegion: 'us',
  regions: [
    { id: 'us', name: 'United States' },
    { id: 'eu', name: 'Europe' },
  ],
  onBack: vi.fn(),
  onChangeRegion: vi.fn(),
  onViewStats: vi.fn(),
  onResetTodaysGame: vi.fn(),
  onResetAllData: vi.fn(),
  onRefreshData: vi.fn(),
  refreshingData: false,
  hasUpdate: false,
};

describe('SettingsView', () => {
  it('shows the current region name', () => {
    render(<SettingsView {...DEFAULT_PROPS} />);
    expect(screen.getByText('United States')).toBeInTheDocument();
  });

  it('fires every action handler', () => {
    const props = {
      ...DEFAULT_PROPS,
      onBack: vi.fn(),
      onChangeRegion: vi.fn(),
      onViewStats: vi.fn(),
      onResetTodaysGame: vi.fn(),
      onResetAllData: vi.fn(),
      onRefreshData: vi.fn(),
    };
    render(<SettingsView {...props} />);

    fireEvent.click(screen.getByText('← Back'));
    fireEvent.click(screen.getByText('Change Region'));
    fireEvent.click(screen.getByText('View Stats'));
    fireEvent.click(screen.getByText("Reset Today's Game"));
    fireEvent.click(screen.getByText('Reset All Data'));
    fireEvent.click(screen.getByText('Refresh Game Data'));

    expect(props.onBack).toHaveBeenCalledTimes(1);
    expect(props.onChangeRegion).toHaveBeenCalledTimes(1);
    expect(props.onViewStats).toHaveBeenCalledTimes(1);
    expect(props.onResetTodaysGame).toHaveBeenCalledTimes(1);
    expect(props.onResetAllData).toHaveBeenCalledTimes(1);
    expect(props.onRefreshData).toHaveBeenCalledTimes(1);
  });

  it('disables refresh while refreshing and shows the update banner', () => {
    render(
      <SettingsView
        {...DEFAULT_PROPS}
        refreshingData={true}
        hasUpdate={true}
      />,
    );

    const refreshButton = screen
      .getByText('Refreshing Data...')
      .closest('button');
    expect(refreshButton).toBeDisabled();
    expect(
      screen.getByText(/New data available/i),
    ).toBeInTheDocument();
  });
});

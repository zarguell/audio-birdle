import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameInitialization } from '@/hooks/useGameInitialization';
import { useNormalGameStore } from '@/stores/normalGameStore';

vi.mock('@/stores/normalGameStore');

describe('useGameInitialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNormalGameStore.getState.mockReturnValue({
      getDailyGame: vi.fn(() => null),
      setDailyGame: vi.fn(),
    });
  });

  it('should initialize game for valid region and date', () => {
    const mockSetDailyGame = vi.fn();
    useNormalGameStore.getState.mockReturnValue({
      getDailyGame: vi.fn(() => null),
      setDailyGame: mockSetDailyGame,
    });

    renderHook(() =>
      useGameInitialization('us', '2025-01-15', null)
    );

    expect(mockSetDailyGame).toHaveBeenCalledWith('us-2025-01-15', {
      region: 'us',
      date: '2025-01-15',
      guesses: [],
      completed: false,
      won: false,
      maxGuesses: 4,
    });
  });

  it('should not initialize game if region is missing', () => {
    const mockSetDailyGame = vi.fn();
    useNormalGameStore.getState.mockReturnValue({
      getDailyGame: vi.fn(() => null),
      setDailyGame: mockSetDailyGame,
    });

    renderHook(() =>
      useGameInitialization(null, '2025-01-15', null)
    );

    expect(mockSetDailyGame).not.toHaveBeenCalled();
  });

  it('should not initialize game if date is missing', () => {
    const mockSetDailyGame = vi.fn();
    useNormalGameStore.getState.mockReturnValue({
      getDailyGame: vi.fn(() => null),
      setDailyGame: mockSetDailyGame,
    });

    renderHook(() =>
      useGameInitialization('us', null, null)
    );

    expect(mockSetDailyGame).not.toHaveBeenCalled();
  });

  it('should not initialize game if currentDailyGame exists', () => {
    const mockSetDailyGame = vi.fn();
    useNormalGameStore.getState.mockReturnValue({
      getDailyGame: vi.fn(() => ({ guesses: [] })),
      setDailyGame: mockSetDailyGame,
    });

    renderHook(() =>
      useGameInitialization('us', '2025-01-15', { guesses: [] })
    );

    expect(mockSetDailyGame).not.toHaveBeenCalled();
  });

  it('should check for existing game before initializing', () => {
    const mockGetDailyGame = vi.fn(() => ({ guesses: [] }));
    const mockSetDailyGame = vi.fn();
    useNormalGameStore.getState.mockReturnValue({
      getDailyGame: mockGetDailyGame,
      setDailyGame: mockSetDailyGame,
    });

    renderHook(() =>
      useGameInitialization('us', '2025-01-15', null)
    );

    expect(mockGetDailyGame).toHaveBeenCalledWith('us-2025-01-15');
    expect(mockSetDailyGame).not.toHaveBeenCalled();
  });
});

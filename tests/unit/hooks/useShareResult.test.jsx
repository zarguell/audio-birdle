import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useShareResult } from '@/hooks/useShareResult';
import { generateShareText, shareResult } from '@/utils/ShareUtils';

vi.mock('@/utils/ShareUtils');
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useCallback: (fn) => fn,
  };
});

describe('useShareResult', () => {
  const mockDailyGame = {
    guesses: [
      { birdId: 'amerob', correct: true, timestamp: 1234567890 },
    ],
    completed: true,
    won: true,
    maxGuesses: 4,
  };

  const mockBird = {
    id: 'amerob',
    name: 'American Robin',
    scientificName: 'Turdus migratorius',
  };

  const mockRegion = 'us';

  beforeEach(() => {
    vi.clearAllMocks();
    global.window = { location: { href: 'https://example.com' } };
  });

  it('should return handleShareResult function', () => {
    const { result } = renderHook(() =>
      useShareResult(mockDailyGame, mockBird, mockRegion)
    );

    expect(result.current.handleShareResult).toBeDefined();
    expect(typeof result.current.handleShareResult).toBe('function');
  });

  it('should call generateShareText with correct parameters', async () => {
    const mockShareText = 'Audio-Birdle 1/4';
    generateShareText.mockReturnValue(mockShareText);

    const { result } = renderHook(() =>
      useShareResult(mockDailyGame, mockBird, mockRegion)
    );

    await result.current.handleShareResult();

    expect(generateShareText).toHaveBeenCalledWith(
      mockDailyGame,
      'https://example.com',
      'American Robin',
      'us'
    );
  });

  it('should call shareResult with generated share text', async () => {
    const mockShareText = 'Audio-Birdle 1/4';
    generateShareText.mockReturnValue(mockShareText);

    const { result } = renderHook(() =>
      useShareResult(mockDailyGame, mockBird, mockRegion)
    );

    await result.current.handleShareResult();

    expect(shareResult).toHaveBeenCalledWith(mockShareText);
  });

  it('should not share if currentDailyGame is missing', async () => {
    const { result } = renderHook(() =>
      useShareResult(null, mockBird, mockRegion)
    );

    await result.current.handleShareResult();

    expect(generateShareText).not.toHaveBeenCalled();
    expect(shareResult).not.toHaveBeenCalled();
  });

  it('should not share if todaysBird is missing', async () => {
    const { result } = renderHook(() =>
      useShareResult(mockDailyGame, null, mockRegion)
    );

    await result.current.handleShareResult();

    expect(generateShareText).not.toHaveBeenCalled();
    expect(shareResult).not.toHaveBeenCalled();
  });

  it('should handle empty region', async () => {
    generateShareText.mockReturnValue('Audio-Birdle 1/4');

    const { result } = renderHook(() =>
      useShareResult(mockDailyGame, mockBird, null)
    );

    await result.current.handleShareResult();

    expect(generateShareText).toHaveBeenCalledWith(
      mockDailyGame,
      'https://example.com',
      'American Robin',
      null
    );
  });
});

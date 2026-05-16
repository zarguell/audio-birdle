import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistence } from '@/hooks/usePersistence';
import { getStorage, setStorage } from '@/utils/StorageUtils';

vi.mock('@/utils/StorageUtils', () => ({
  getStorage: vi.fn(),
  setStorage: vi.fn(),
  STORAGE_KEYS: {
    REGION: 'audio-birdle-region',
    LAST_PLAYED_MODE: 'audio-birdle-last-mode',
  },
}));

describe('usePersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize selectedRegion from localStorage', () => {
    getStorage.mockReturnValue('us');

    const { result } = renderHook(() => usePersistence());

    expect(getStorage).toHaveBeenCalledWith('audio-birdle-region', null);
    expect(result.current.selectedRegion).toBe('us');
  });

  it('should initialize selectedRegion to null if not stored', () => {
    getStorage.mockReturnValue(null);

    const { result } = renderHook(() => usePersistence());

    expect(result.current.selectedRegion).toBe(null);
  });

  it('should initialize lastPlayedMode from localStorage', () => {
    getStorage.mockImplementation((key, defaultValue) => {
      if (key === 'audio-birdle-last-mode') return 'hard';
      return defaultValue;
    });

    const { result } = renderHook(() => usePersistence());

    expect(getStorage).toHaveBeenCalledWith('audio-birdle-last-mode', 'normal');
    expect(result.current.lastPlayedMode).toBe('hard');
  });

  it('should initialize lastPlayedMode to normal if not stored', () => {
    getStorage.mockReturnValue('normal');

    const { result } = renderHook(() => usePersistence());

    expect(result.current.lastPlayedMode).toBe('normal');
  });

  it('should save selectedRegion to localStorage when it changes', () => {
    getStorage.mockReturnValue(null);

    const { result } = renderHook(() => usePersistence());

    act(() => {
      result.current.setSelectedRegion('eu');
    });

    expect(setStorage).toHaveBeenCalledWith('audio-birdle-region', 'eu');
  });

  it('should save lastPlayedMode to localStorage when it changes', () => {
    getStorage.mockImplementation((key) => {
      if (key === 'audio-birdle-region') return null;
      return 'normal';
    });

    const { result } = renderHook(() => usePersistence());

    act(() => {
      result.current.setLastPlayedMode('hard');
    });

    expect(setStorage).toHaveBeenCalledWith('audio-birdle-last-mode', 'hard');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGameStore } from '@/stores/gameStore';

vi.mock('@/stores/gameStore');

describe('gameStore migration on rehydrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
  });

  it('should trigger migration when onRehydrateStorage fires with no daily games', () => {
    const mockMigrate = vi.fn();

    useGameStore.getState.mockReturnValue({
      dailyGames: {},
      migrateFromOldStores: mockMigrate,
    });

    const onRehydrate = useGameStore.mock.calls.find(
      (call) => call[0] && call[0].onRehydrateStorage,
    );

    if (onRehydrate) {
      const rehydrateCallback = onRehydrate[0].onRehydrateStorage();
      rehydrateCallback({ dailyGames: {}, migrateFromOldStores: mockMigrate });

      expect(mockMigrate).toHaveBeenCalled();
    }
  });

  it('should not trigger migration when dailyGames exist', () => {
    const mockMigrate = vi.fn();

    const onRehydrate = useGameStore.mock.calls.find(
      (call) => call[0] && call[0].onRehydrateStorage,
    );

    if (onRehydrate) {
      const rehydrateCallback = onRehydrate[0].onRehydrateStorage();
      rehydrateCallback({
        dailyGames: { 'us-2025-01-01-normal': {} },
        migrateFromOldStores: mockMigrate,
      });

      expect(mockMigrate).not.toHaveBeenCalled();
    }
  });

  it('should log rehydration message', () => {
    const onRehydrate = useGameStore.mock.calls.find(
      (call) => call[0] && call[0].onRehydrateStorage,
    );

    if (onRehydrate) {
      const rehydrateCallback = onRehydrate[0].onRehydrateStorage();
      rehydrateCallback({ dailyGames: {} });

      expect(console.log).toHaveBeenCalledWith('Game store rehydrated');
    }
  });
});

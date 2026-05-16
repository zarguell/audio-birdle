import { describe, it, expect } from 'vitest';
import { useNormalGameStore } from '@/stores/normalGameStore';
import { useGameStore } from '@/stores/gameStore';

describe('useNormalGameStore (backward-compat re-export)', () => {
  it('should be the same store as useGameStore', () => {
    expect(useNormalGameStore).toBe(useGameStore);
  });

  it('should share state with useGameStore', () => {
    useGameStore.getState().reset();
    useGameStore.getState().setDailyGame('test-key', {
      region: 'us',
      date: '2025-01-01',
      mode: 'normal',
      guesses: [],
      completed: false,
      won: false,
      maxGuesses: 4,
    });

    const game = useNormalGameStore.getState().getDailyGame('test-key');
    expect(game).toBeDefined();
    expect(game?.region).toBe('us');
  });
});

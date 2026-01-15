import { create } from 'zustand';
import type { Bird } from '../utils/LoadGameData';

/**
 * Practice Mode State
 *
 * Practice mode is NOT persisted (no localStorage).
 * It's designed for free play with unlimited rounds.
 */

export interface PracticeGuess {
  birdId: string;
  correct: boolean;
  timestamp: number;
}

export interface PracticeState {
  currentBird: Bird | null;
  guesses: PracticeGuess[];
  completed: boolean;
  setCurrentBird: (bird: Bird | null) => void;
  addGuess: (guess: PracticeGuess) => void;
  setCompleted: (completed: boolean) => void;
  reset: () => void;
}

/**
 * Practice Mode Store
 *
 * Lightweight state management for practice mode.
 * Not persisted - state resets on page refresh.
 */
export const usePracticeStore = create<PracticeState>((set) => ({
  // State
  currentBird: null,
  guesses: [],
  completed: false,

  // Actions
  setCurrentBird: (bird) => set({ currentBird: bird, guesses: [], completed: false }),

  addGuess: (guess) =>
    set((state) => ({
      guesses: [...state.guesses, guess],
      completed: guess.correct || state.completed,
    })),

  setCompleted: (completed) => set({ completed }),

  /**
   * Reset practice mode state
   * Useful for starting a new practice round
   */
  reset: () =>
    set({
      currentBird: null,
      guesses: [],
      completed: false,
    }),
}));

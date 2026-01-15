import { describe, it, expect, beforeEach } from 'vitest';
import { usePracticeStore } from '@/stores/practiceStore';

describe('usePracticeStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    usePracticeStore.getState().reset();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = usePracticeStore.getState();
      expect(state.currentBird).toBeNull();
      expect(state.guesses).toEqual([]);
      expect(state.completed).toBe(false);
    });
  });

  describe('setCurrentBird', () => {
    it('should set current bird', () => {
      const { setCurrentBird } = usePracticeStore.getState();
      const bird = {
        id: 'amerob',
        name: 'American Robin',
        scientificName: 'Turdus migratorius',
        order: 'Passeriformes',
        family: 'Turdidae (Turdidae)',
        audioUrl: ['https://example.com/audio.mp3'],
      };

      setCurrentBird(bird);

      const state = usePracticeStore.getState();
      expect(state.currentBird).toEqual(bird);
    });

    it('should reset guesses and completed when setting new bird', () => {
      const { setCurrentBird, addGuess, setCompleted } = usePracticeStore.getState();
      const bird = {
        id: 'amerob',
        name: 'American Robin',
        scientificName: 'Turdus migratorius',
        order: 'Passeriformes',
        family: 'Turdidae (Turdidae)',
        audioUrl: ['https://example.com/audio.mp3'],
      };

      // Add a guess and mark as completed
      addGuess({
        birdId: 'wrong',
        correct: false,
        timestamp: Date.now(),
      });
      setCompleted(true);

      expect(usePracticeStore.getState().guesses).toHaveLength(1);
      expect(usePracticeStore.getState().completed).toBe(true);

      // Set new bird should reset
      setCurrentBird(bird);

      const state = usePracticeStore.getState();
      expect(state.guesses).toEqual([]);
      expect(state.completed).toBe(false);
    });

    it('should clear current bird when set to null', () => {
      const { setCurrentBird } = usePracticeStore.getState();
      const bird = {
        id: 'amerob',
        name: 'American Robin',
        scientificName: 'Turdus migratorius',
        order: 'Passeriformes',
        family: 'Turdidae (Turdidae)',
        audioUrl: ['https://example.com/audio.mp3'],
      };

      setCurrentBird(bird);
      expect(usePracticeStore.getState().currentBird).toEqual(bird);

      setCurrentBird(null);
      expect(usePracticeStore.getState().currentBird).toBeNull();
    });
  });

  describe('addGuess', () => {
    it('should add a guess', () => {
      const { addGuess } = usePracticeStore.getState();
      const guess = {
        birdId: 'amerob',
        correct: true,
        timestamp: Date.now(),
      };

      addGuess(guess);

      const state = usePracticeStore.getState();
      expect(state.guesses).toHaveLength(1);
      expect(state.guesses[0]).toEqual(guess);
    });

    it('should add multiple guesses', () => {
      const { addGuess } = usePracticeStore.getState();

      for (let i = 0; i < 3; i++) {
        addGuess({
          birdId: `bird${i}`,
          correct: i === 2,
          timestamp: Date.now(),
        });
      }

      const state = usePracticeStore.getState();
      expect(state.guesses).toHaveLength(3);
      expect(state.guesses[2].birdId).toBe('bird2');
    });

    it('should mark as completed when guess is correct', () => {
      const { addGuess } = usePracticeStore.getState();

      addGuess({
        birdId: 'amerob',
        correct: true,
        timestamp: Date.now(),
      });

      const state = usePracticeStore.getState();
      expect(state.completed).toBe(true);
    });

    it('should keep completed state if already completed', () => {
      const { addGuess, setCompleted } = usePracticeStore.getState();

      setCompleted(true);
      expect(usePracticeStore.getState().completed).toBe(true);

      addGuess({
        birdId: 'wrong',
        correct: false,
        timestamp: Date.now(),
      });

      const state = usePracticeStore.getState();
      expect(state.completed).toBe(true);
    });

    it('should not mark as completed when guess is incorrect', () => {
      const { addGuess } = usePracticeStore.getState();

      addGuess({
        birdId: 'wrong',
        correct: false,
        timestamp: Date.now(),
      });

      const state = usePracticeStore.getState();
      expect(state.completed).toBe(false);
    });
  });

  describe('setCompleted', () => {
    it('should set completed to true', () => {
      const { setCompleted } = usePracticeStore.getState();
      setCompleted(true);

      const state = usePracticeStore.getState();
      expect(state.completed).toBe(true);
    });

    it('should set completed to false', () => {
      const { setCompleted } = usePracticeStore.getState();
      setCompleted(true);
      expect(usePracticeStore.getState().completed).toBe(true);

      setCompleted(false);
      expect(usePracticeStore.getState().completed).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const { setCurrentBird, addGuess, setCompleted, reset } =
        usePracticeStore.getState();
      const bird = {
        id: 'amerob',
        name: 'American Robin',
        scientificName: 'Turdus migratorius',
        order: 'Passeriformes',
        family: 'Turdidae (Turdidae)',
        audioUrl: ['https://example.com/audio.mp3'],
      };

      // Set up state
      setCurrentBird(bird);
      addGuess({
        birdId: 'wrong',
        correct: false,
        timestamp: Date.now(),
      });
      setCompleted(true);

      // Verify state is set
      expect(usePracticeStore.getState().currentBird).toEqual(bird);
      expect(usePracticeStore.getState().guesses).toHaveLength(1);
      expect(usePracticeStore.getState().completed).toBe(true);

      // Reset
      reset();

      const state = usePracticeStore.getState();
      expect(state.currentBird).toBeNull();
      expect(state.guesses).toEqual([]);
      expect(state.completed).toBe(false);
    });
  });

  describe('Practice Mode Persistence', () => {
    it.skip('should not persist to localStorage', () => {
      const { setCurrentBird, addGuess } = usePracticeStore.getState();
      const bird = {
        id: 'amerob',
        name: 'American Robin',
        scientificName: 'Turdus migratorius',
        order: 'Passeriformes',
        family: 'Turdidae (Turdidae)',
        audioUrl: ['https://example.com/audio.mp3'],
      };

      setCurrentBird(bird);
      addGuess({
        birdId: 'wrong',
        correct: false,
        timestamp: Date.now(),
      });

      // Verify localStorage is empty
      const keys = Object.keys(localStorage);
      expect(keys).toHaveLength(0);
    });
  });

  describe('Practice Mode Workflow', () => {
    it('should support typical practice mode flow', () => {
      const { setCurrentBird, addGuess, reset } = usePracticeStore.getState();
      const bird = {
        id: 'amerob',
        name: 'American Robin',
        scientificName: 'Turdus migratorius',
        order: 'Passeriformes',
        family: 'Turdidae (Turdidae)',
        audioUrl: ['https://example.com/audio.mp3'],
      };

      // Start new practice round
      setCurrentBird(bird);
      expect(usePracticeStore.getState().currentBird).toEqual(bird);
      expect(usePracticeStore.getState().guesses).toHaveLength(0);

      // Make first guess (incorrect)
      addGuess({
        birdId: 'rowar1',
        correct: false,
        timestamp: Date.now(),
      });
      expect(usePracticeStore.getState().guesses).toHaveLength(1);
      expect(usePracticeStore.getState().completed).toBe(false);

      // Make second guess (correct)
      addGuess({
        birdId: 'amerob',
        correct: true,
        timestamp: Date.now(),
      });
      expect(usePracticeStore.getState().guesses).toHaveLength(2);
      expect(usePracticeStore.getState().completed).toBe(true);

      // Start new round
      reset();
      const bird2 = {
        id: 'cantig',
        name: 'Canvasback',
        scientificName: 'Aythya valisineria',
        order: 'Anseriformes',
        family: 'Anatidae (Anatidae)',
        audioUrl: ['https://example.com/audio2.mp3'],
      };
      setCurrentBird(bird2);
      expect(usePracticeStore.getState().currentBird).toEqual(bird2);
      expect(usePracticeStore.getState().guesses).toHaveLength(0);
      expect(usePracticeStore.getState().completed).toBe(false);
    });
  });
});

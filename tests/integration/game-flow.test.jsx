/**
 * Game Flow Integration Tests
 *
 * These tests verify the complete game flow from data loading through
 * game state management and persistence. They test the integration
 * of multiple utility modules working together.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  processGuess,
  ensureGameStateFormat,
  getUserPerformanceSummary
} from '@/utils/GameLogic'
import { getStoredData, setStoredData } from '@/utils/StorageUtils'
import { useNormalGameStore } from '@/stores/normalGameStore'

// Mock localStorage for testing
const mockLocalStorage = {
  storage: {},
  getItem(key) {
    return this.storage[key] || null
  },
  setItem(key, value) {
    this.storage[key] = value
  },
  removeItem(key) {
    delete this.storage[key]
  },
  clear() {
    this.storage = {}
  }
}

describe('Game Flow Integration Tests', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    mockLocalStorage.clear()
    vi.stubGlobal('localStorage', mockLocalStorage)

    // Reset Zustand stores to prevent test pollution
    useNormalGameStore.getState().reset()
  })

  describe('Complete Daily Game Flow', () => {
    it('should process multiple guesses and track stats correctly', () => {
      const region = 'us'
      const date = '2025-01-15'
      const testBird = {
        id: 'amerob',
        name: 'American Robin',
        family: 'Turdidae (Turdidae)'
      }

      let gameState = { dailyGames: {}, stats: { totalGamesPlayed: 0, totalGamesWon: 0, currentStreak: 0, maxStreak: 0, regionStats: {} }, lastPlayed: null, version: 2 }

      // First guess - incorrect
      gameState = processGuess(gameState, region, date, 'mallar3', testBird.id)
      expect(gameState.dailyGames[`${region}-${date}`].guesses).toHaveLength(1)
      expect(gameState.dailyGames[`${region}-${date}`].guesses[0].correct).toBe(false)
      expect(gameState.dailyGames[`${region}-${date}`].completed).toBe(false)

      // Second guess - incorrect
      gameState = processGuess(gameState, region, date, 'horlar', testBird.id)
      expect(gameState.dailyGames[`${region}-${date}`].guesses).toHaveLength(2)
      expect(gameState.dailyGames[`${region}-${date}`].completed).toBe(false)

      // Third guess - correct
      gameState = processGuess(gameState, region, date, testBird.id, testBird.id)
      expect(gameState.dailyGames[`${region}-${date}`].guesses).toHaveLength(3)
      expect(gameState.dailyGames[`${region}-${date}`].guesses[2].correct).toBe(true)
      expect(gameState.dailyGames[`${region}-${date}`].completed).toBe(true)
      expect(gameState.dailyGames[`${region}-${date}`].won).toBe(true)
    })

    it('should handle game loss after max guesses', () => {
      const region = 'us'
      const date = '2025-01-15'
      const testBird = {
        id: 'amerob',
        name: 'American Robin',
        family: 'Turdidae (Turdidae)'
      }

      let gameState = { dailyGames: {}, stats: { totalGamesPlayed: 0, totalGamesWon: 0, currentStreak: 0, maxStreak: 0, regionStats: {} }, lastPlayed: null, version: 2 }

      // Make 4 incorrect guesses
      for (let i = 0; i < 4; i++) {
        gameState = processGuess(gameState, region, date, `wrong-bird-${i}`, testBird.id)
      }

      expect(gameState.dailyGames[`${region}-${date}`].guesses).toHaveLength(4)
      expect(gameState.dailyGames[`${region}-${date}`].completed).toBe(true)
      expect(gameState.dailyGames[`${region}-${date}`].won).toBe(false)
    })
  })

  describe('State Persistence and Migration', () => {
    it('should migrate v1 state to v2 format', () => {
      // Create a v1 state (old format)
      const v1State = {
        currentRegion: 'us',
        gameState: {
          guesses: [],
          completed: false,
          won: false
        },
        stats: {
          played: 10,
          won: 5
        }
      }

      mockLocalStorage.storage['game-state'] = JSON.stringify(v1State)

      // Load and migrate
      const loadedData = getStoredData('game-state')
      const migratedState = ensureGameStateFormat(loadedData)

      expect(migratedState.version).toBe(2)
      expect(migratedState.dailyGames).toBeDefined()
      expect(migratedState.stats).toBeDefined()
    })

    it('should preserve data during migration', () => {
      const v1State = {
        currentRegion: 'eu',
        gameState: {
          guesses: [{ birdId: 'test', correct: true, timestamp: Date.now() }],
          completed: true,
          won: true
        },
        stats: {
          played: 20,
          won: 15
        }
      }

      mockLocalStorage.storage['game-state'] = JSON.stringify(v1State)

      const loadedData = getStoredData('game-state')
      const migratedState = ensureGameStateFormat(loadedData)

      expect(migratedState.version).toBe(2)
      expect(migratedState.stats.totalGamesPlayed).toBeDefined()
    })

    it('should save and load state correctly', () => {
      const testState = {
        version: 2,
        dailyGames: {
          'us-2025-01-15': {
            region: 'us',
            date: '2025-01-15',
            guesses: [],
            completed: false,
            won: false,
            maxGuesses: 4
          }
        },
        stats: {
          totalGamesPlayed: 5,
          totalGamesWon: 3,
          currentStreak: 2,
          maxStreak: 3,
          regionStats: {
            us: { gamesPlayed: 5, gamesWon: 3, averageGuesses: 2.5 }
          }
        }
      }

      setStoredData('game-state', testState)
      const loadedState = getStoredData('game-state')

      expect(loadedState).toEqual(testState)
    })
  })

  describe('Statistics Aggregation', () => {
    it('should calculate performance summary correctly', () => {
      const complexState = {
        version: 2,
        dailyGames: {
          'us-2025-01-15': {
            region: 'us',
            date: '2025-01-15',
            guesses: [{ birdId: 'amerob', correct: true, timestamp: Date.now() }],
            completed: true,
            won: true,
            maxGuesses: 4
          },
          'us-2025-01-14': {
            region: 'us',
            date: '2025-01-14',
            guesses: [
              { birdId: 'wrong1', correct: false, timestamp: Date.now() },
              { birdId: 'wrong2', correct: false, timestamp: Date.now() },
              { birdId: 'correct', correct: true, timestamp: Date.now() }
            ],
            completed: true,
            won: true,
            maxGuesses: 4
          },
          'eu-2025-01-15': {
            region: 'eu',
            date: '2025-01-15',
            guesses: [
              { birdId: 'wrong1', correct: false, timestamp: Date.now() },
              { birdId: 'wrong2', correct: false, timestamp: Date.now() },
              { birdId: 'wrong3', correct: false, timestamp: Date.now() },
              { birdId: 'wrong4', correct: false, timestamp: Date.now() }
            ],
            completed: true,
            won: false,
            maxGuesses: 4
          }
        },
        stats: {
          totalGamesPlayed: 3,
          totalGamesWon: 2,
          averageGuesses: 2.67,
          currentStreak: 1,
          maxStreak: 2,
          regionStats: {
            us: { gamesPlayed: 2, gamesWon: 2, averageGuesses: 2 },
            eu: { gamesPlayed: 1, gamesWon: 0, averageGuesses: 4 }
          }
        }
      }

      const summary = getUserPerformanceSummary(complexState)

      expect(summary.totalGames).toBe(3)
      expect(summary.winRate).toBe('66.7')
      expect(summary.averageGuesses).toBe('2.7')
      expect(summary.currentStreak).toBe(1)
      expect(summary.maxStreak).toBe(2)
      expect(summary.regionBreakdown).toHaveLength(2)
    })
  })

  describe('Error Handling', () => {
    it('should handle corrupted localStorage gracefully', () => {
      mockLocalStorage.storage['game-state'] = 'invalid-json{{{'

      const loadedData = getStoredData('game-state', null)
      expect(loadedData).toBeNull()

      // Should create fresh state
      const freshState = ensureGameStateFormat(null)
      expect(freshState.version).toBe(2)
      expect(freshState.dailyGames).toEqual({})
    })

    it('should handle missing localStorage keys', () => {
      const data = getStoredData('non-existent-key', null)
      expect(data).toBeNull()
    })
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGameStore } from '@/stores/gameStore'
import { createMockLocalStorage } from '@test/setup'
import { createTestGameState, createTestDailyGame, createTestBird, createCompletedGame, createHardModeGame, createHardModeGuess } from '@test/fixtures/integration-fixtures'

describe('Store Interactions Integration', () => {
  let mockStorage

  beforeEach(() => {
    mockStorage = createMockLocalStorage()
    vi.stubGlobal('localStorage', mockStorage)
    vi.clearAllMocks()
    useGameStore.getState().reset()
  })

  describe('Normal Game Store', () => {
    const NORMAL_KEY = 'us-2025-01-15-normal'

    it('should create a new daily game entry', () => {
      const game = { ...createTestDailyGame(), mode: 'normal' }

      useGameStore.getState().setDailyGame(NORMAL_KEY, game)

      const retrieved = useGameStore.getState().getDailyGame(NORMAL_KEY)
      expect(retrieved).toEqual(game)
      expect(retrieved?.completed).toBe(false)
      expect(retrieved?.won).toBe(false)
    })

    it('should add a guess to a game', () => {
      const game = { ...createTestDailyGame(), mode: 'normal' }
      useGameStore.getState().setDailyGame(NORMAL_KEY, game)

      const guess = {
        birdId: 'testbird',
        correct: false,
        timestamp: Date.now()
      }

      useGameStore.getState().processGuess(NORMAL_KEY, guess)

      const retrieved = useGameStore.getState().getDailyGame(NORMAL_KEY)
      expect(retrieved?.guesses).toHaveLength(1)
      expect(retrieved?.guesses[0]).toEqual(guess)
    })

    it('should complete a game on correct guess', () => {
      const game = { ...createTestDailyGame({ maxGuesses: 4 }), mode: 'normal' }
      useGameStore.getState().setDailyGame(NORMAL_KEY, game)

      const guess = {
        birdId: 'correct',
        correct: true,
        timestamp: Date.now()
      }

      useGameStore.getState().processGuess(NORMAL_KEY, guess)

      const retrieved = useGameStore.getState().getDailyGame(NORMAL_KEY)
      expect(retrieved?.completed).toBe(true)
      expect(retrieved?.won).toBe(true)
      expect(retrieved?.guesses).toHaveLength(1)
    })

    it('should complete a game on max guesses without winning', () => {
      const game = { ...createTestDailyGame({ maxGuesses: 4 }), mode: 'normal' }
      useGameStore.getState().setDailyGame(NORMAL_KEY, game)

      for (let i = 0; i < 4; i++) {
        const guess = {
          birdId: `wrong-${i}`,
          correct: false,
          timestamp: Date.now() + i
        }
        useGameStore.getState().processGuess(NORMAL_KEY, guess)
      }

      const retrieved = useGameStore.getState().getDailyGame(NORMAL_KEY)
      expect(retrieved?.completed).toBe(true)
      expect(retrieved?.won).toBe(false)
      expect(retrieved?.guesses).toHaveLength(4)
    })

    it('should update stats on game completion', () => {
      const game = { ...createTestDailyGame({ region: 'us', maxGuesses: 4 }), mode: 'normal' }
      useGameStore.getState().setDailyGame(NORMAL_KEY, game)

      const guess = {
        birdId: 'correct',
        correct: true,
        timestamp: Date.now()
      }

      useGameStore.getState().processGuess(NORMAL_KEY, guess)

      const stats = useGameStore.getState().stats
      expect(stats.totalGamesPlayed).toBe(1)
      expect(stats.totalGamesWon).toBe(1)
      expect(stats.currentStreak).toBe(1)
      expect(stats.maxStreak).toBe(1)
      expect(stats.regionStats.us).toBeDefined()
      expect(stats.regionStats.us.gamesPlayed).toBe(1)
      expect(stats.regionStats.us.gamesWon).toBe(1)
    })

    it('should not allow guesses after game completion', () => {
      const game = { ...createTestDailyGame({ maxGuesses: 4, completed: true, won: true }), mode: 'normal' }
      useGameStore.getState().setDailyGame(NORMAL_KEY, game)

      const guess = {
        birdId: 'testbird',
        correct: false,
        timestamp: Date.now()
      }

      useGameStore.getState().processGuess(NORMAL_KEY, guess)

      const retrieved = useGameStore.getState().getDailyGame(NORMAL_KEY)
      expect(retrieved?.guesses).toHaveLength(0)
    })
  })

  describe('Hard Mode Store', () => {
    const HARD_KEY = 'us-2025-01-15-hard'

    it('should create a new hard mode game', () => {
      const game = createHardModeGame()

      useGameStore.getState().setDailyGame(HARD_KEY, game)

      const retrieved = useGameStore.getState().getDailyGame(HARD_KEY)
      expect(retrieved).toEqual(game)
      expect(retrieved?.mode).toBe('hard')
      expect(retrieved?.completed).toBe(false)
    })

    it('should add a text guess with taxonomic scoring', () => {
      const game = createHardModeGame()
      useGameStore.getState().setDailyGame(HARD_KEY, game)

      const guess = createHardModeGuess({
        taxonomicScore: {
          order: true,
          family: false,
          genus: false,
          species: false
        }
      })

      useGameStore.getState().processGuess(HARD_KEY, guess)

      const retrieved = useGameStore.getState().getDailyGame(HARD_KEY)
      expect(retrieved?.guesses).toHaveLength(1)
      expect(retrieved?.guesses[0].textInput).toBe('Test Bird')
      expect(retrieved?.guesses[0].taxonomicScore.order).toBe(true)
    })

    it('should complete hard mode game on correct guess', () => {
      const game = createHardModeGame({ maxGuesses: 6 })
      useGameStore.getState().setDailyGame(HARD_KEY, game)

      const guess = createHardModeGuess({
        correct: true,
        birdId: 'correct'
      })

      useGameStore.getState().processGuess(HARD_KEY, guess)

      const retrieved = useGameStore.getState().getDailyGame(HARD_KEY)
      expect(retrieved?.completed).toBe(true)
      expect(retrieved?.won).toBe(true)
    })

    it('should update hard mode stats on completion', () => {
      const game = createHardModeGame({ region: 'us', maxGuesses: 6 })
      useGameStore.getState().setDailyGame(HARD_KEY, game)

      const guess = createHardModeGuess({ correct: true })

      useGameStore.getState().processGuess(HARD_KEY, guess)

      const stats = useGameStore.getState().stats
      expect(stats.totalGamesPlayed).toBe(1)
      expect(stats.totalGamesWon).toBe(1)
      expect(stats.currentStreak).toBe(1)
      expect(stats.regionStats.us).toBeDefined()
      expect(stats.regionStats.us.gamesPlayed).toBe(1)
      expect(stats.regionStats.us.gamesWon).toBe(1)
    })

    it('should track region-specific stats', () => {
      const game1 = createHardModeGame({ region: 'us', maxGuesses: 6 })
      useGameStore.getState().setDailyGame(HARD_KEY, game1)

      const guess = createHardModeGuess({ correct: true })
      useGameStore.getState().processGuess(HARD_KEY, guess)

      const stats = useGameStore.getState().stats
      expect(stats.regionStats.us).toBeDefined()
      expect(stats.regionStats.us.gamesPlayed).toBe(1)
      expect(stats.regionStats.us.gamesWon).toBe(1)
    })
  })

  describe('State Migration', () => {
    it('should migrate old Zustand persist format to unified keys', () => {
      const oldPersistedState = {
        state: {
          dailyGames: {
            'us-2025-01-15': {
              region: 'us',
              date: '2025-01-15',
              guesses: [{ birdId: 'test', correct: true, timestamp: Date.now() }],
              completed: true,
              won: true,
              maxGuesses: 4
            }
          },
          stats: {
            totalGamesPlayed: 1,
            totalGamesWon: 1,
            currentStreak: 1,
            maxStreak: 1,
            regionStats: {}
          }
        },
        version: 2
      }

      mockStorage.setItem('audio-birdle-normal-game', JSON.stringify(oldPersistedState))

      useGameStore.getState().migrateFromOldStores()

      const migratedGame = useGameStore.getState().getDailyGame('us-2025-01-15-normal')
      expect(migratedGame).toBeDefined()
      expect(migratedGame?.region).toBe('us')
      expect(migratedGame?.date).toBe('2025-01-15')
      expect(migratedGame?.completed).toBe(true)
      expect(migratedGame?.won).toBe(true)
    })

    it('should migrate empty dailyGames state', () => {
      const oldPersistedState = {
        state: {
          dailyGames: {},
          stats: {
            totalGamesPlayed: 0,
            totalGamesWon: 0,
            currentStreak: 0,
            maxStreak: 0,
            regionStats: {}
          }
        },
        version: 2
      }

      mockStorage.setItem('audio-birdle-normal-game', JSON.stringify(oldPersistedState))

      useGameStore.getState().migrateFromOldStores()

      const migratedGame = useGameStore.getState().getDailyGame('us-2025-01-15-normal')
      expect(migratedGame).toBeUndefined()
    })

    it('should handle migration idempotently', () => {
      const oldPersistedState = {
        state: {
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
            totalGamesPlayed: 0,
            totalGamesWon: 0,
            currentStreak: 0,
            maxStreak: 0,
            regionStats: {}
          }
        },
        version: 2
      }

      mockStorage.setItem('audio-birdle-normal-game', JSON.stringify(oldPersistedState))

      useGameStore.getState().migrateFromOldStores()
      useGameStore.getState().migrateFromOldStores()

      const migratedGame = useGameStore.getState().getDailyGame('us-2025-01-15-normal')
      expect(migratedGame).toBeDefined()
    })

    it('should migrate hard mode state from old persist format', () => {
      const oldPersistedState = {
        state: {
          hardModeGames: {
            'eu-2025-01-15': {
              region: 'eu',
              date: '2025-01-15',
              mode: 'hard',
              guesses: [],
              completed: false,
              won: false,
              maxGuesses: 6
            }
          },
          stats: {
            totalGamesPlayed: 0,
            totalGamesWon: 0,
            currentStreak: 0,
            maxStreak: 0,
            regionStats: {}
          }
        },
        version: 2
      }

      mockStorage.setItem('audio-birdle-hard-mode', JSON.stringify(oldPersistedState))

      useGameStore.getState().migrateFromOldStores()

      const migratedGame = useGameStore.getState().getDailyGame('eu-2025-01-15-hard')
      expect(migratedGame).toBeDefined()
      expect(migratedGame?.mode).toBe('hard')
      expect(migratedGame?.region).toBe('eu')
    })

    it('should handle no old data gracefully', () => {
      mockStorage.clear()

      useGameStore.getState().migrateFromOldStores()

      expect(useGameStore.getState().dailyGames).toEqual({})
    })
  })

  describe('Cross-Store Isolation', () => {
    it('should keep normal and hard mode games separate', () => {
      const normKey = 'us-2025-01-15-normal'
      const hardKey = 'us-2025-01-15-hard'

      useGameStore.getState().setDailyGame(normKey, { ...createTestDailyGame(), mode: 'normal' })
      useGameStore.getState().setDailyGame(hardKey, createHardModeGame())

      const normalGame = useGameStore.getState().getDailyGame(normKey)
      const hardModeGame = useGameStore.getState().getDailyGame(hardKey)

      expect(normalGame).toBeDefined()
      expect(hardModeGame).toBeDefined()
      expect(normalGame?.maxGuesses).toBe(4)
      expect(hardModeGame?.maxGuesses).toBe(6)
    })
  })

  describe('Stats Aggregation', () => {
    it('should aggregate stats across multiple games', () => {
      const game1 = { ...createTestDailyGame({ region: 'us', maxGuesses: 4 }), mode: 'normal' }
      const game2 = { ...createTestDailyGame({ region: 'eu', maxGuesses: 4 }), mode: 'normal' }

      useGameStore.getState().setDailyGame('us-2025-01-15-normal', game1)
      useGameStore.getState().setDailyGame('eu-2025-01-15-normal', game2)

      const guess1 = { birdId: 'correct', correct: true, timestamp: Date.now() }
      useGameStore.getState().processGuess('us-2025-01-15-normal', guess1)

      const guess2 = { birdId: 'correct', correct: true, timestamp: Date.now() }
      useGameStore.getState().processGuess('eu-2025-01-15-normal', guess2)

      const stats = useGameStore.getState().stats
      expect(stats.totalGamesPlayed).toBe(2)
      expect(stats.totalGamesWon).toBe(2)
      expect(stats.currentStreak).toBe(2)
    })

    it('should reset streak on loss', () => {
      const game = { ...createTestDailyGame({ region: 'us', maxGuesses: 4 }), mode: 'normal' }
      useGameStore.getState().setDailyGame('us-2025-01-15-normal', game)

      for (let i = 0; i < 4; i++) {
        const guess = { birdId: `wrong-${i}`, correct: false, timestamp: Date.now() + i }
        useGameStore.getState().processGuess('us-2025-01-15-normal', guess)
      }

      const stats = useGameStore.getState().stats
      expect(stats.currentStreak).toBe(0)
      expect(stats.totalGamesPlayed).toBe(1)
      expect(stats.totalGamesWon).toBe(0)
    })

    it('should calculate average guesses correctly', () => {
      useGameStore.getState().setDailyGame('us-2025-01-15-normal', { ...createTestDailyGame({ region: 'us', maxGuesses: 4 }), mode: 'normal' })
      useGameStore.getState().setDailyGame('us-2025-01-16-normal', { ...createTestDailyGame({ region: 'us', maxGuesses: 4 }), mode: 'normal' })
      useGameStore.getState().setDailyGame('us-2025-01-17-normal', { ...createTestDailyGame({ region: 'us', maxGuesses: 4 }), mode: 'normal' })

      const guess1 = { birdId: 'correct', correct: true, timestamp: Date.now() }
      useGameStore.getState().processGuess('us-2025-01-15-normal', guess1)

      const guess2 = { birdId: 'correct', correct: true, timestamp: Date.now() + 1 }
      useGameStore.getState().processGuess('us-2025-01-16-normal', guess2)

      const guess3 = { birdId: 'correct', correct: true, timestamp: Date.now() + 2 }
      useGameStore.getState().processGuess('us-2025-01-17-normal', guess3)

      const stats = useGameStore.getState().stats
      expect(stats.regionStats.us.totalGuesses).toBe(3)
      expect(stats.regionStats.us.gamesPlayed).toBe(3)
      expect(stats.regionStats.us.averageGuesses).toBe(1)
    })
  })

  describe('Reset Functionality', () => {
    it('should reset game store to initial state', () => {
      useGameStore.getState().setDailyGame('us-2025-01-15-normal', { ...createTestDailyGame(), mode: 'normal' })
      useGameStore.getState().processGuess('us-2025-01-15-normal', {
        birdId: 'correct',
        correct: true,
        timestamp: Date.now()
      })

      useGameStore.getState().reset()

      expect(useGameStore.getState().dailyGames).toEqual({})
      expect(useGameStore.getState().stats.totalGamesPlayed).toBe(0)
    })
  })
})

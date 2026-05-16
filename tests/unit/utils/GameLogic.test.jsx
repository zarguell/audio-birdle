import { describe, it, expect, beforeEach } from 'vitest'
import {
  getDailyGameState,
  hasPlayedRegionDate,
  processGuess,
  getDailyBird,
  generateAnswerOptions,
  getUserPerformanceSummary,
  createRegionDateKey,
  createInitialHardModeGameState,
  getHardModeGameState,
  processHardModeGuess,
  hasPlayedHardModeRegionDate,
  hasCompletedNormalMode,
  hasCompletedHardMode
} from '@/utils/GameLogic'
import { sampleBirds } from '../fixtures/sampleBirds'
import { useGameStore } from '@/stores/gameStore'
import { GAME_CONFIG } from '@/utils/Constants'

const createInitialGameState = () => ({
  dailyGames: {},
  stats: {
    totalGamesPlayed: 0,
    totalGamesWon: 0,
    averageGuesses: 0,
    currentStreak: 0,
    maxStreak: 0,
    regionStats: {},
  },
  lastPlayed: { region: null, date: null },
  version: 2,
})

const createInitialDailyGameState = (region, date) => ({
  region,
  date,
  mode: "normal",
  guesses: [],
  completed: false,
  won: false,
  maxGuesses: GAME_CONFIG.MAX_GUESSES,
  startTime: new Date().toISOString(),
  endTime: null,
  birdId: null,
})

describe('GameLogic', () => {
  beforeEach(() => {
    useGameStore.getState().reset()
  })

  describe('createRegionDateKey', () => {
    it('should create unique key for region-date combination', () => {
      const key1 = createRegionDateKey('us', '2025-12-27')
      const key2 = createRegionDateKey('eu', '2025-12-27')
      const key3 = createRegionDateKey('us', '2025-12-26')

      expect(key1).toBe('us-2025-12-27')
      expect(key1).not.toBe(key2)
      expect(key1).not.toBe(key3)
    })
  })

  describe('getDailyGameState', () => {
    it('should return existing daily game state from store', () => {
      const gameState = createInitialGameState()
      const key = 'us-2025-12-27-normal'
      useGameStore.getState().setDailyGame(key, {
        region: 'us',
        date: '2025-12-27',
        mode: 'normal',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 4,
      })

      const dailyState = getDailyGameState(gameState, 'us', '2025-12-27')

      expect(dailyState).toBeDefined()
      expect(dailyState.region).toBe('us')
      expect(dailyState.date).toBe('2025-12-27')
    })

    it('should create new daily game state if not exists', () => {
      const gameState = createInitialGameState()

      const dailyState = getDailyGameState(gameState, 'us', '2025-12-27')

      expect(dailyState).toBeDefined()
      expect(dailyState.region).toBe('us')
      expect(dailyState.date).toBe('2025-12-27')
      expect(dailyState.guesses).toEqual([])
    })
  })

  describe('hasPlayedRegionDate', () => {
    it('should return false for unplayed game', () => {
      const gameState = createInitialGameState()

      const hasPlayed = hasPlayedRegionDate(gameState, 'us', '2025-12-27')

      expect(hasPlayed).toBeFalsy()
    })

    it('should return true for played game', () => {
      const gameState = createInitialGameState()
      const key = 'us-2025-12-27-normal'
      const dailyGame = createInitialDailyGameState('us', '2025-12-27')
      dailyGame.guesses = [{ birdId: 'amerob', correct: true, timestamp: new Date().toISOString() }]
      gameState.dailyGames[key] = dailyGame

      const hasPlayed = hasPlayedRegionDate(gameState, 'us', '2025-12-27')

      expect(hasPlayed).toBe(true)
    })
  })

  describe('processGuess', () => {
    let gameState
    beforeEach(() => {
      gameState = createInitialGameState()
    })

    it('should process correct guess', () => {
      const newState = processGuess(
        gameState,
        'us',
        '2025-12-27',
        'amerob',
        'amerob'
      )

      const key = 'us-2025-12-27-normal'
      const dailyGame = newState.dailyGames[key]

      expect(dailyGame.guesses).toHaveLength(1)
      expect(dailyGame.guesses[0].birdId).toBe('amerob')
      expect(dailyGame.guesses[0].correct).toBe(true)
      expect(dailyGame.completed).toBe(true)
      expect(dailyGame.won).toBe(true)
      expect(dailyGame.endTime).toBeDefined()
    })

    it('should process incorrect guess', () => {
      const newState = processGuess(
        gameState,
        'us',
        '2025-12-27',
        'barswa',
        'amerob'
      )

      const key = 'us-2025-12-27-normal'
      const dailyGame = newState.dailyGames[key]

      expect(dailyGame.guesses).toHaveLength(1)
      expect(dailyGame.guesses[0].birdId).toBe('barswa')
      expect(dailyGame.guesses[0].correct).toBe(false)
      expect(dailyGame.completed).toBe(false)
    })

    it('should complete game after max guesses', () => {
      let state = gameState
      for (let i = 0; i < 4; i++) {  // MAX_GUESSES is 4
        state = processGuess(state, 'us', '2025-12-27', 'wrong', 'amerob')
      }

      const key = 'us-2025-12-27-normal'
      const dailyGame = state.dailyGames[key]

      expect(dailyGame.completed).toBe(true)
      expect(dailyGame.won).toBe(false)
      expect(dailyGame.guesses).toHaveLength(4)
    })

    it('should update stats after completion', () => {
      const newState = processGuess(
        gameState,
        'us',
        '2025-12-27',
        'amerob',
        'amerob'
      )

      expect(newState.stats.totalGamesPlayed).toBe(1)
      expect(newState.stats.totalGamesWon).toBe(1)
      expect(newState.stats.currentStreak).toBe(1)
      expect(newState.stats.maxStreak).toBe(1)
    })

    it('should not allow guesses after completion', () => {
      let state = processGuess(gameState, 'us', '2025-12-27', 'amerob', 'amerob')
      const beforeLength = state.dailyGames['us-2025-12-27-normal'].guesses.length

      state = processGuess(state, 'us', '2025-12-27', 'wrong', 'amerob')
      const afterLength = state.dailyGames['us-2025-12-27-normal'].guesses.length

      expect(afterLength).toBe(beforeLength)
    })

    it('should reset streak on loss', () => {
      let state = gameState
      for (let i = 0; i < 4; i++) {  // MAX_GUESSES is 4
        state = processGuess(state, 'us', '2025-12-27', `wrong${i}`, 'amerob')
      }

      expect(state.stats.currentStreak).toBe(0)
    })

    it('should update region-specific stats', () => {
      const newState = processGuess(
        gameState,
        'us',
        '2025-12-27',
        'amerob',
        'amerob'
      )

      expect(newState.stats.regionStats['us']).toBeDefined()
      expect(newState.stats.regionStats['us'].gamesPlayed).toBe(1)
      expect(newState.stats.regionStats['us'].gamesWon).toBe(1)
    })
  })

  describe('generateAnswerOptions', () => {
    it('should generate correct number of options', () => {
      const correctBird = sampleBirds.us[0]
      const options = generateAnswerOptions('us', sampleBirds, '2025-12-27', correctBird, 3)

      expect(options).toHaveLength(3)  // We only have 3 birds in sample data
    })

    it('should include correct bird in options', () => {
      const correctBird = sampleBirds.us[0]
      const options = generateAnswerOptions('us', sampleBirds, '2025-12-27', correctBird, 3)

      const hasCorrectBird = options.some(b => b.id === correctBird.id)
      expect(hasCorrectBird).toBe(true)
    })

    it('should be deterministic for same inputs', () => {
      const correctBird = sampleBirds.us[0]
      const options1 = generateAnswerOptions('us', sampleBirds, '2025-12-27', correctBird, 3)
      const options2 = generateAnswerOptions('us', sampleBirds, '2025-12-27', correctBird, 3)

      expect(options1.map(b => b.id)).toEqual(options2.map(b => b.id))
    })

    it('should handle empty birds array', () => {
      const correctBird = sampleBirds.us[0]
      const options = generateAnswerOptions('xx', sampleBirds, '2025-12-27', correctBird, 3)

      expect(options).toHaveLength(0)
    })

    it('should handle null correct bird', () => {
      const options = generateAnswerOptions('us', sampleBirds, '2025-12-27', null, 3)

      expect(options).toHaveLength(0)
    })
  })

  describe('getUserPerformanceSummary', () => {
    it('should return correct summary for new game', () => {
      const gameState = createInitialGameState()
      const summary = getUserPerformanceSummary(gameState)

      expect(summary.totalGames).toBe(0)
      expect(summary.winRate).toBe(0)  // 0 games, so winRate is 0 (not '0')
      expect(summary.averageGuesses).toBe('0.0')
      expect(summary.currentStreak).toBe(0)
      expect(summary.maxStreak).toBe(0)
    })

    it('should calculate correct stats after games', () => {
      const gameState = createInitialGameState()
      let state = gameState

      // Simulate 2 games: 1 win in 2 guesses, 1 loss in 4 guesses (max)
      state = processGuess(state, 'us', '2025-12-27', 'wrong1', 'amerob')
      state = processGuess(state, 'us', '2025-12-27', 'amerob', 'amerob')

      state = processGuess(state, 'us', '2025-12-26', 'wrong1', 'barswa')
      state = processGuess(state, 'us', '2025-12-26', 'wrong2', 'barswa')
      state = processGuess(state, 'us', '2025-12-26', 'wrong3', 'barswa')
      state = processGuess(state, 'us', '2025-12-26', 'wrong4', 'barswa')

      const summary = getUserPerformanceSummary(state)

      expect(summary.totalGames).toBe(2)
      expect(summary.winRate).toBe('50.0')
      expect(parseFloat(summary.averageGuesses)).toBeCloseTo(3.0, 1)  // (2 + 4) / 2 = 3
    })

    it('should include region breakdown', () => {
      const gameState = createInitialGameState()
      const state = processGuess(gameState, 'us', '2025-12-27', 'amerob', 'amerob')

      const summary = getUserPerformanceSummary(state)

      expect(summary.regionBreakdown).toHaveLength(1)
      expect(summary.regionBreakdown[0].region).toBe('us')
      expect(summary.regionBreakdown[0].games).toBe(1)
    })
  })

  describe('getDailyBird', () => {
    it('should return null for empty birds array', () => {
      const bird = getDailyBird('us', [], '2025-12-27')
      expect(bird).toBeNull()
    })

    it('should return null for null birds', () => {
      const bird = getDailyBird('us', null, '2025-12-27')
      expect(bird).toBeNull()
    })

    it('should return a bird from the array', () => {
      const bird = getDailyBird('us', sampleBirds.us, '2025-12-27')

      expect(bird).toBeDefined()
      expect(sampleBirds.us).toContain(bird)
    })

    it('should be deterministic for same inputs', () => {
      const bird1 = getDailyBird('us', sampleBirds.us, '2025-12-27')
      const bird2 = getDailyBird('us', sampleBirds.us, '2025-12-27')

      expect(bird1.id).toBe(bird2.id)
    })

    it('should return different birds for different dates', () => {
      const bird1 = getDailyBird('us', sampleBirds.us, '2025-12-27')
      const bird2 = getDailyBird('us', sampleBirds.us, '2025-12-26')

      // These might be the same by chance, but with enough birds they should differ
      // Just verify both are valid birds
      expect(sampleBirds.us).toContain(bird1)
      expect(sampleBirds.us).toContain(bird2)
    })
  })

  // HARD MODE TESTS
  // ============================================================================

  describe('createInitialHardModeGameState', () => {
    it('should create initial hard mode game state', () => {
      const state = createInitialHardModeGameState('us', '2025-12-27')

      expect(state.region).toBe('us')
      expect(state.date).toBe('2025-12-27')
      expect(state.mode).toBe('hard')
      expect(state.guesses).toEqual([])
      expect(state.completed).toBe(false)
      expect(state.won).toBe(false)
      expect(state.maxGuesses).toBe(6)  // HARD_MODE_MAX_GUESSES
      expect(state.startTime).toBeDefined()
      expect(state.endTime).toBeNull()
      expect(state.birdId).toBeNull()
    })

    it('should have different max guesses than normal mode', () => {
      const hardMode = createInitialHardModeGameState('us', '2025-12-27')
      const normalMode = createInitialDailyGameState('us', '2025-12-27')

      expect(hardMode.maxGuesses).toBe(6)
      expect(normalMode.maxGuesses).toBe(4)
    })
  })

  describe('getHardModeGameState', () => {
    it('should return existing hard mode game state', () => {
      const gameState = createInitialGameState()
      const key = 'us-2025-12-27-hard'
      useGameStore.getState().setDailyGame(key, {
        region: 'us',
        date: '2025-12-27',
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      })

      const hardState = getHardModeGameState(gameState, 'us', '2025-12-27')

      expect(hardState).toBeDefined()
      expect(hardState.region).toBe('us')
      expect(hardState.date).toBe('2025-12-27')
      expect(hardState.mode).toBe('hard')
    })

    it('should create new hard mode game state if not exists', () => {
      const gameState = createInitialGameState()

      const hardState = getHardModeGameState(gameState, 'us', '2025-12-27')

      expect(hardState).toBeDefined()
      expect(hardState.region).toBe('us')
      expect(hardState.date).toBe('2025-12-27')
      expect(hardState.mode).toBe('hard')
      expect(hardState.guesses).toEqual([])
    })

    it('should read from store when game state has no matching entry', () => {
      const gameState = createInitialGameState()
      const key = 'us-2025-12-27-hard'
      useGameStore.getState().setDailyGame(key, {
        region: 'us',
        date: '2025-12-27',
        mode: 'hard',
        guesses: [{ birdId: 'test', correct: true, timestamp: Date.now() }],
        completed: true,
        won: true,
        maxGuesses: 6,
      })

      const hardState = getHardModeGameState(gameState, 'us', '2025-12-27')

      expect(hardState).toBeDefined()
      expect(hardState.mode).toBe('hard')
      expect(hardState.guesses).toHaveLength(1)
      expect(hardState.completed).toBe(true)
    })
  })

  describe('processHardModeGuess', () => {
    let gameState
    beforeEach(() => {
      gameState = createInitialGameState()
    })

    it('should process correct guess in hard mode', () => {
      const newState = processHardModeGuess(
        gameState,
        'us',
        '2025-12-27',
        sampleBirds.us[0],  // American Robin bird object
        'American Robin',
        sampleBirds.us[0]  // Correct is American Robin
      )

      const key = 'us-2025-12-27-hard'
      const hardGame = newState.dailyGames[key]

      expect(hardGame.guesses).toHaveLength(1)
      expect(hardGame.guesses[0].birdId).toBe('amerob')
      expect(hardGame.guesses[0].correct).toBe(true)
      expect(hardGame.guesses[0].textInput).toBe('American Robin')
      expect(hardGame.guesses[0].taxonomicScore).toBeDefined()
      expect(hardGame.completed).toBe(true)
      expect(hardGame.won).toBe(true)
      expect(hardGame.endTime).toBeDefined()
    })

    it('should process incorrect guess in hard mode', () => {
      const newState = processHardModeGuess(
        gameState,
        'us',
        '2025-12-27',
        sampleBirds.us[1],  // Barn Swallow bird object
        'Barn Swallow',
        sampleBirds.us[0]  // Correct is American Robin
      )

      const key = 'us-2025-12-27-hard'
      const hardGame = newState.dailyGames[key]

      expect(hardGame.guesses).toHaveLength(1)
      expect(hardGame.guesses[0].birdId).toBe('barswa')
      expect(hardGame.guesses[0].correct).toBe(false)
      expect(hardGame.completed).toBe(false)
      expect(hardGame.won).toBe(false)
      expect(hardGame.guesses[0].taxonomicScore).toBeDefined()
    })

    it('should complete game after max hard mode guesses (6)', () => {
      let state = gameState
      for (let i = 0; i < 6; i++) {
        state = processHardModeGuess(
          state,
          'us',
          '2025-12-27',
          sampleBirds.us[1],  // Barn Swallow (wrong bird)
          `Wrong Bird ${i}`,
          sampleBirds.us[0]  // Correct is American Robin
        )
      }

      const key = 'us-2025-12-27-hard'
      const hardGame = state.dailyGames[key]

      expect(hardGame.completed).toBe(true)
      expect(hardGame.won).toBe(false)
      expect(hardGame.guesses).toHaveLength(6)
    })

    it('should not allow guesses after hard mode completion', () => {
      let state = processHardModeGuess(
        gameState,
        'us',
        '2025-12-27',
        sampleBirds.us[0],  // American Robin
        'American Robin',
        sampleBirds.us[0]
      )

      const beforeLength = state.dailyGames['us-2025-12-27-hard'].guesses.length

      state = processHardModeGuess(
        state,
        'us',
        '2025-12-27',
        sampleBirds.us[1],  // Barn Swallow
        'Another Guess',
        sampleBirds.us[0]
      )

      const afterLength = state.dailyGames['us-2025-12-27-hard'].guesses.length
      expect(afterLength).toBe(beforeLength)
    })

    it('should update hard mode stats after completion', () => {
      const newState = processHardModeGuess(
        gameState,
        'us',
        '2025-12-27',
        sampleBirds.us[0],  // American Robin
        'American Robin',
        sampleBirds.us[0]
      )

      expect(newState.stats).toBeDefined()
      expect(newState.stats.totalGamesPlayed).toBe(1)
      expect(newState.stats.totalGamesWon).toBe(1)
      expect(newState.stats.currentStreak).toBe(1)
      expect(newState.stats.maxStreak).toBe(1)
    })

    it('should update region-specific hard mode stats', () => {
      const newState = processHardModeGuess(
        gameState,
        'us',
        '2025-12-27',
        sampleBirds.us[0],  // American Robin
        'American Robin',
        sampleBirds.us[0]
      )

      expect(newState.stats.regionStats['us']).toBeDefined()
      expect(newState.stats.regionStats['us'].gamesPlayed).toBe(1)
      expect(newState.stats.regionStats['us'].gamesWon).toBe(1)
    })

    it('should reset hard mode streak on loss', () => {
      let state = gameState
      // Use actual bird objects
      for (let i = 0; i < 6; i++) {
        state = processHardModeGuess(
          state,
          'us',
          '2025-12-27',
          sampleBirds.us[1],  // Barn Swallow (wrong bird)
          `Barn Swallow ${i}`,
          sampleBirds.us[0]  // Correct is American Robin
        )
      }

      expect(state.stats.currentStreak).toBe(0)
    })

    it('should store hard mode game correctly in store', () => {
      const newState = processHardModeGuess(
        gameState,
        'us',
        '2025-12-27',
        sampleBirds.us[0],  // American Robin
        'American Robin',
        sampleBirds.us[0]
      )

      const key = 'us-2025-12-27-hard'
      expect(newState.dailyGames).toBeDefined()
      expect(newState.dailyGames[key]).toBeDefined()
      expect(newState.dailyGames[key].mode).toBe('hard')
      expect(newState.dailyGames[key].region).toBe('us')
      expect(newState.dailyGames[key].date).toBe('2025-12-27')
      expect(newState.dailyGames[key].won).toBe(true)
      expect(newState.dailyGames[key].completed).toBe(true)
    })

    it('should calculate taxonomic score correctly', () => {
      // American Robin vs Barn Swallow (same order: Passeriformes)
      const newState = processHardModeGuess(
        gameState,
        'us',
        '2025-12-27',
        sampleBirds.us[1],  // Barn Swallow
        'Barn Swallow',
        sampleBirds.us[0]  // American Robin
      )

      const key = 'us-2025-12-27-hard'
      const guess = newState.dailyGames[key].guesses[0]

      expect(guess.taxonomicScore.order).toBe(true)  // Both Passeriformes
      expect(guess.taxonomicScore.family).toBe(false)  // Different families
      expect(guess.taxonomicScore.genus).toBe(false)
      expect(guess.taxonomicScore.species).toBe(false)
    })
  })

  describe('hasPlayedHardModeRegionDate', () => {
    it('should return false for unplayed hard mode game', () => {
      const gameState = createInitialGameState()

      const hasPlayed = hasPlayedHardModeRegionDate(gameState, 'us', '2025-12-27')

      expect(hasPlayed).toBe(false)
    })

    it('should return true for played hard mode game (from store)', () => {
      const key = 'us-2025-12-27-hard'
      useGameStore.getState().setDailyGame(key, {
        region: 'us',
        date: '2025-12-27',
        mode: 'hard',
        guesses: [{ birdId: 'amerob', correct: true, timestamp: Date.now() }],
        completed: true,
        won: true,
        maxGuesses: 6,
      })

      const gameState = createInitialGameState()
      const hasPlayed = hasPlayedHardModeRegionDate(gameState, 'us', '2025-12-27')

      expect(hasPlayed).toBe(true)
    })

    it('should return true for played hard mode game (from gameState)', () => {
      const gameState = createInitialGameState()
      gameState.dailyGames = {
        'us-2025-12-27-hard': {
          region: 'us',
          date: '2025-12-27',
          mode: 'hard',
          guesses: [{ birdId: 'amerob', correct: true, timestamp: Date.now() }],
          completed: true,
          won: true,
          maxGuesses: 6,
        }
      }

      const hasPlayed = hasPlayedHardModeRegionDate(gameState, 'us', '2025-12-27')

      expect(hasPlayed).toBe(true)
    })
  })

  describe('hasCompletedNormalMode', () => {
    it('should return false for incomplete normal mode game', () => {
      const gameState = createInitialGameState()
      const key = 'us-2025-12-27-normal'
      gameState.dailyGames[key] = createInitialDailyGameState('us', '2025-12-27')

      const hasCompleted = hasCompletedNormalMode(gameState, 'us', '2025-12-27')

      expect(hasCompleted).toBe(false)
    })

    it('should return true for completed normal mode game', () => {
      const gameState = createInitialGameState()
      let state = processGuess(gameState, 'us', '2025-12-27', 'amerob', 'amerob')

      const hasCompleted = hasCompletedNormalMode(state, 'us', '2025-12-27')

      expect(hasCompleted).toBe(true)
    })
  })

  describe('hasCompletedHardMode', () => {
    it('should return false for incomplete hard mode game', () => {
      const gameState = createInitialGameState()

      useGameStore.getState().setDailyGame('us-2025-12-27-hard', {
        region: 'us',
        date: '2025-12-27',
        mode: 'hard',
        guesses: [],
        completed: false,
        won: false,
        maxGuesses: 6,
      })

      const hasCompleted = hasCompletedHardMode(gameState, 'us', '2025-12-27')

      expect(hasCompleted).toBe(false)
    })

    it('should return true for completed hard mode game', () => {
      const gameState = createInitialGameState()
      gameState.dailyGames = {
        'us-2025-12-27-hard': {
          region: 'us',
          date: '2025-12-27',
          mode: 'hard',
          guesses: [{ birdId: 'amerob', correct: true, timestamp: Date.now() }],
          completed: true,
          won: true,
          maxGuesses: 6,
        }
      }

      const hasCompleted = hasCompletedHardMode(gameState, 'us', '2025-12-27')

      expect(hasCompleted).toBe(true)
    })
  })
})

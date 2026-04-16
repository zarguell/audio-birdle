// hashString imported for potential future test use
import { hashString as UNUSED_HASH } from '@/utils/HashUtils'

export function createTestBird(overrides = {}) {
  return {
    id: 'testbird',
    name: 'Test Bird',
    scientificName: 'Testus birdus',
    order: 'Passeriformes',
    family: 'Testidae (Testidae)',
    audioUrl: ['http://example.com/audio.mp3'],
    ...overrides
  }
}

export function createTestBirdList(count = 10, overrides = {}) {
  return Array.from({ length: count }, (_, i) =>
    createTestBird({
      id: `bird${i}`,
      name: `Bird ${i}`,
      ...overrides
    })
  )
}

export function createTestGameState(overrides = {}) {
  return {
    version: 2,
    dailyGames: {},
    hardModeGames: {},
    stats: {
      totalGamesPlayed: 0,
      totalGamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      regionStats: {}
    },
    hardModeStats: {
      totalGamesPlayed: 0,
      totalGamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      regionStats: {}
    },
    ...overrides
  }
}

export function createTestDailyGame(overrides = {}) {
  return {
    region: 'us',
    date: '2025-01-15',
    guesses: [],
    completed: false,
    won: false,
    maxGuesses: 4,
    ...overrides
  }
}

export function createTestRegion(overrides = {}) {
  return {
    code: 'test',
    name: 'Test Region',
    subregions: ['test-sub-1', 'test-sub-2'],
    ...overrides
  }
}

export function createTestRegionList() {
  return [
    createTestRegion({ code: 'us', name: 'United States' }),
    createTestRegion({ code: 'eu', name: 'Europe' }),
    createTestRegion({ code: 'as', name: 'Asia' })
  ]
}

export function createTestDailyEntry(overrides = {}) {
  return {
    date: '2025-01-15',
    region: 'us',
    answerHash: 'a1b2c3d4',
    ...overrides
  }
}

export function createMockBirdDataByRegion() {
  return {
    us: createTestBirdList(50),
    eu: createTestBirdList(40),
    as: createTestBirdList(45)
  }
}

export function createMockDailyData() {
  const dates = ['2025-01-13', '2025-01-14', '2025-01-15']
  return dates.map(date =>
    createTestDailyEntry({ date, region: 'us' })
  )
}

export function createCompletedGame(won = true, guesses = 1, overrides = {}) {
  return {
    region: 'us',
    date: '2025-01-16',
    guesses: Array.from({ length: guesses }, (_, i) => ({
      birdId: won && i === guesses - 1 ? 'correct' : `wrong-${i}`,
      correct: won && i === guesses - 1,
      timestamp: Date.now() - (guesses - i) * 1000
    })),
    completed: true,
    won,
    maxGuesses: 4,
    ...overrides
  }
}

export function createHardModeGame(overrides = {}) {
  return {
    region: 'us',
    date: '2025-01-15',
    mode: 'hard',
    guesses: [],
    completed: false,
    won: false,
    maxGuesses: 6,
    ...overrides
  }
}

export function createHardModeGuess(overrides = {}) {
  return {
    birdId: 'testbird',
    textInput: 'Test Bird',
    correct: false,
    timestamp: Date.now(),
    taxonomicScore: {
      order: false,
      family: false,
      genus: false,
      species: false
    },
    ...overrides
  }
}

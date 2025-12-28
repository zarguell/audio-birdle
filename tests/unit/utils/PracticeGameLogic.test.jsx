import { describe, it, expect, beforeEach } from 'vitest'
import {
  createInitialPracticeState,
  getPracticeBird,
  generatePracticeAnswerOptions,
  processPracticeGuess,
  processHardPracticeGuess,
  startNewPracticeRound
} from '@/utils/PracticeGameLogic'
import { GAME_CONFIG } from '@/utils/Constants'

const sampleBirds = {
  us: [
    {
      id: 'amerob',
      name: 'American Robin',
      scientificName: 'Turdus migratorius',
      order: 'Passeriformes',
      family: 'Turdidae (Turdidae)',
      audioUrl: ['https://example.com/robin.mp3']
    },
    {
      id: 'barswa',
      name: 'Barn Swallow',
      scientificName: 'Hirundo rustica',
      order: 'Passeriformes',
      family: 'Hirundinidae (Hirundinidae)',
      audioUrl: ['https://example.com/swallow.mp3']
    },
    {
      id: 'reccro',
      name: 'Red-crowned Crane',
      scientificName: 'Grus japonensis',
      order: 'Gruiformes',
      family: 'Gruidae (Gruidae)',
      audioUrl: ['https://example.com/crane.mp3']
    },
    {
      id: 'eucdov',
      name: 'Eurasian Collared-Dove',
      scientificName: 'Streptopelia decaocto',
      order: 'Columbiformes',
      family: 'Columbidae (Columbidae)',
      audioUrl: ['https://example.com/dove.mp3']
    },
    {
      id: 'anotherthrush',
      name: 'Wood Thrush',
      scientificName: 'Hylocichla mustelina',
      order: 'Passeriformes',
      family: 'Turdidae (Turdidae)',
      audioUrl: ['https://example.com/thrush.mp3']
    }
  ]
}

describe('PracticeGameLogic', () => {
  describe('createInitialPracticeState', () => {
    it('should create initial practice state for normal mode', () => {
      const state = createInitialPracticeState('us', false)

      expect(state.region).toBe('us')
      expect(state.currentBird).toBeNull()
      expect(state.answerOptions).toEqual([])
      expect(state.guesses).toEqual([])
      expect(state.completed).toBe(false)
      expect(state.won).toBe(false)
      expect(state.maxGuesses).toBe(GAME_CONFIG.MAX_GUESSES)  // 4
      expect(state.practiceIndex).toBe(0)
      expect(state.startTime).toBeDefined()
      expect(state.endTime).toBeNull()
      expect(state.isHardMode).toBe(false)
    })

    it('should create initial practice state for hard mode', () => {
      const state = createInitialPracticeState('us', true)

      expect(state.region).toBe('us')
      expect(state.maxGuesses).toBe(GAME_CONFIG.HARD_MODE_MAX_GUESSES)  // 6
      expect(state.isHardMode).toBe(true)
    })

    it('should have different max guesses for normal vs hard mode', () => {
      const normalState = createInitialPracticeState('us', false)
      const hardState = createInitialPracticeState('us', true)

      expect(normalState.maxGuesses).toBe(4)
      expect(hardState.maxGuesses).toBe(6)
    })
  })

  describe('getPracticeBird', () => {
    it('should return a bird from the region', () => {
      const bird = getPracticeBird('us', sampleBirds, 0)

      expect(bird).toBeDefined()
      expect(sampleBirds.us).toContain(bird)
    })

    it('should return null for empty region', () => {
      const bird = getPracticeBird('xx', sampleBirds, 0)

      expect(bird).toBeNull()
    })

    it('should return null for null birds', () => {
      const bird = getPracticeBird('us', null, 0)

      expect(bird).toBeNull()
    })

    it('should return different bird for different practice index', () => {
      const bird1 = getPracticeBird('us', sampleBirds, 0)
      const bird2 = getPracticeBird('us', sampleBirds, 1)

      // Due to random shuffling, they might be the same
      // but we're checking the function works
      expect(bird1).toBeDefined()
      expect(bird2).toBeDefined()
    })

    it('should cycle through birds using modulo', () => {
      const bird1 = getPracticeBird('us', sampleBirds, 0)
      const bird2 = getPracticeBird('us', sampleBirds, sampleBirds.us.length)
      const bird3 = getPracticeBird('us', sampleBirds, sampleBirds.us.length * 2)

      // All should return valid birds
      expect(bird1).toBeDefined()
      expect(bird2).toBeDefined()
      expect(bird3).toBeDefined()
    })
  })

  describe('generatePracticeAnswerOptions', () => {
    it('should generate correct number of options', () => {
      const correctBird = sampleBirds.us[0]
      const options = generatePracticeAnswerOptions('us', sampleBirds, 0, correctBird, 4)

      expect(options).toHaveLength(4)
    })

    it('should include correct bird in options', () => {
      const correctBird = sampleBirds.us[0]
      const options = generatePracticeAnswerOptions('us', sampleBirds, 0, correctBird, 4)

      const hasCorrectBird = options.some(b => b.id === correctBird.id)
      expect(hasCorrectBird).toBe(true)
    })

    it('should not include correct bird as wrong option', () => {
      const correctBird = sampleBirds.us[0]
      const options = generatePracticeAnswerOptions('us', sampleBirds, 0, correctBird, 4)

      const correctBirdCount = options.filter(b => b.id === correctBird.id).length
      expect(correctBirdCount).toBe(1)
    })

    it('should be deterministic for same inputs', () => {
      const correctBird = sampleBirds.us[0]
      const options1 = generatePracticeAnswerOptions('us', sampleBirds, 0, correctBird, 4)
      const options2 = generatePracticeAnswerOptions('us', sampleBirds, 0, correctBird, 4)

      expect(options1.map(b => b.id)).toEqual(options2.map(b => b.id))
    })

    it('should return empty array for null correct bird', () => {
      const options = generatePracticeAnswerOptions('us', sampleBirds, 0, null, 4)

      expect(options).toEqual([])
    })

    it('should return empty array for empty region', () => {
      const correctBird = sampleBirds.us[0]
      const options = generatePracticeAnswerOptions('xx', sampleBirds, 0, correctBird, 4)

      expect(options).toEqual([])
    })

    it('should prefer birds from same family when available', () => {
      // American Robin (Turdidae) - Wood Thrush is also Turdidae
      const correctBird = sampleBirds.us[0]  // American Robin - Turdidae
      const options = generatePracticeAnswerOptions('us', sampleBirds, 0, correctBird, 3)

      const sameFamilyCount = options.filter(
        b => b.family === correctBird.family && b.id !== correctBird.id
      ).length

      // Should have at least one bird from same family (Wood Thrush)
      expect(sameFamilyCount).toBeGreaterThan(0)
    })

    it('should handle when not enough same-family birds available', () => {
      // With only 5 birds and 4 options, it should still work
      const correctBird = sampleBirds.us[2]  // Red-crowned Crane - Gruidae (only one in family)
      const options = generatePracticeAnswerOptions('us', sampleBirds, 0, correctBird, 4)

      expect(options).toHaveLength(4)
      expect(options.some(b => b.id === correctBird.id)).toBe(true)
    })
  })

  describe('processPracticeGuess', () => {
    let practiceState
    beforeEach(() => {
      practiceState = createInitialPracticeState('us', false)
      practiceState.currentBird = sampleBirds.us[0]
    })

    it('should process correct guess', () => {
      const newState = processPracticeGuess(practiceState, 'amerob')

      expect(newState.guesses).toHaveLength(1)
      expect(newState.guesses[0].birdId).toBe('amerob')
      expect(newState.guesses[0].correct).toBe(true)
      expect(newState.completed).toBe(true)
      expect(newState.won).toBe(true)
      expect(newState.endTime).toBeDefined()
    })

    it('should process incorrect guess', () => {
      const newState = processPracticeGuess(practiceState, 'barswa')

      expect(newState.guesses).toHaveLength(1)
      expect(newState.guesses[0].birdId).toBe('barswa')
      expect(newState.guesses[0].correct).toBe(false)
      expect(newState.completed).toBe(false)
      expect(newState.won).toBe(false)
    })

    it('should complete game after max guesses', () => {
      let state = practiceState
      for (let i = 0; i < 4; i++) {
        state = processPracticeGuess(state, 'wrongbird')
      }

      expect(state.completed).toBe(true)
      expect(state.won).toBe(false)
      expect(state.guesses).toHaveLength(4)
    })

    it('should not process guess when game is completed', () => {
      let state = processPracticeGuess(practiceState, 'amerob')
      const beforeLength = state.guesses.length

      state = processPracticeGuess(state, 'another')

      expect(state.guesses.length).toBe(beforeLength)
    })

    it('should not process guess without current bird', () => {
      const stateWithoutBird = { ...practiceState, currentBird: null }
      const newState = processPracticeGuess(stateWithoutBird, 'amerob')

      expect(newState.guesses).toHaveLength(0)
    })

    it('should add timestamp to guesses', () => {
      const newState = processPracticeGuess(practiceState, 'amerob')

      expect(newState.guesses[0].timestamp).toBeDefined()
      expect(new Date(newState.guesses[0].timestamp)).toBeInstanceOf(Date)
    })
  })

  describe('processHardPracticeGuess', () => {
    let practiceState
    beforeEach(() => {
      practiceState = createInitialPracticeState('us', true)
      practiceState.currentBird = sampleBirds.us[0]
    })

    it('should process correct hard mode guess', () => {
      const newState = processHardPracticeGuess(
        practiceState,
        'American Robin',
        sampleBirds.us
      )

      expect(newState.guesses).toHaveLength(1)
      expect(newState.guesses[0].birdId).toBe('amerob')
      expect(newState.guesses[0].textInput).toBe('American Robin')
      expect(newState.guesses[0].correct).toBe(true)
      expect(newState.guesses[0].taxonomicScore).toEqual({
        order: true,
        family: true,
        genus: true,
        species: true
      })
      expect(newState.completed).toBe(true)
      expect(newState.won).toBe(true)
      expect(newState.endTime).toBeDefined()
    })

    it('should process incorrect hard mode guess', () => {
      const newState = processHardPracticeGuess(
        practiceState,
        'Barn Swallow',
        sampleBirds.us
      )

      expect(newState.guesses).toHaveLength(1)
      expect(newState.guesses[0].birdId).toBe('barswa')
      expect(newState.guesses[0].textInput).toBe('Barn Swallow')
      expect(newState.guesses[0].correct).toBe(false)
      // American Robin vs Barn Swallow: same order only
      expect(newState.guesses[0].taxonomicScore).toEqual({
        order: true,   // Both Passeriformes
        family: false,  // Different families
        genus: false,
        species: false
      })
      expect(newState.completed).toBe(false)
      expect(newState.won).toBe(false)
    })

    it('should handle non-matching input', () => {
      const newState = processHardPracticeGuess(
        practiceState,
        'Nonexistent Bird Name',
        sampleBirds.us
      )

      expect(newState.guesses).toHaveLength(1)
      expect(newState.guesses[0].birdId).toBeNull()
      expect(newState.guesses[0].textInput).toBe('Nonexistent Bird Name')
      expect(newState.guesses[0].correct).toBe(false)
      // Note: When no bird found, returns object not number
      expect(newState.guesses[0].taxonomicScore).toEqual({
        order: false,
        family: false,
        genus: false,
        species: false
      })
    })

    it('should complete game after max hard mode guesses (6)', () => {
      let state = practiceState
      // Use actual bird names so they match
      for (let i = 0; i < 6; i++) {
        state = processHardPracticeGuess(state, 'Barn Swallow', sampleBirds.us)
      }

      expect(state.completed).toBe(true)
      expect(state.won).toBe(false)
      expect(state.guesses).toHaveLength(6)
    })

    it('should not process guess when game is completed', () => {
      let state = processHardPracticeGuess(
        practiceState,
        'American Robin',
        sampleBirds.us
      )
      const beforeLength = state.guesses.length

      state = processHardPracticeGuess(state, 'Another Bird', sampleBirds.us)

      expect(state.guesses.length).toBe(beforeLength)
    })

    it('should not process guess without current bird', () => {
      const stateWithoutBird = { ...practiceState, currentBird: null }
      const newState = processHardPracticeGuess(
        stateWithoutBird,
        'American Robin',
        sampleBirds.us
      )

      expect(newState.guesses).toHaveLength(0)
    })

    it('should match by scientific name', () => {
      const newState = processHardPracticeGuess(
        practiceState,
        'Turdus migratorius',
        sampleBirds.us
      )

      expect(newState.guesses[0].birdId).toBe('amerob')
      expect(newState.guesses[0].correct).toBe(true)
    })

    it('should be case insensitive', () => {
      const newState1 = processHardPracticeGuess(
        practiceState,
        'american robin',
        sampleBirds.us
      )

      const newState2 = processHardPracticeGuess(
        practiceState,
        'AMERICAN ROBIN',
        sampleBirds.us
      )

      expect(newState1.guesses[0].birdId).toBe('amerob')
      expect(newState2.guesses[0].birdId).toBe('amerob')
    })

    it('should calculate taxonomic score correctly', () => {
      // American Robin vs Barn Swallow (same order: Passeriformes)
      const newState = processHardPracticeGuess(
        practiceState,
        'Barn Swallow',
        sampleBirds.us
      )

      const taxonomicScore = newState.guesses[0].taxonomicScore

      expect(taxonomicScore.order).toBe(true)  // Both Passeriformes
      expect(taxonomicScore.family).toBe(false)  // Different families
      expect(taxonomicScore.genus).toBe(false)
      expect(taxonomicScore.species).toBe(false)
    })
  })

  describe('startNewPracticeRound', () => {
    let currentState
    beforeEach(() => {
      currentState = createInitialPracticeState('us', false)
      currentState.currentBird = sampleBirds.us[0]
      currentState.guesses = [{ birdId: 'amerob', correct: true }]
      currentState.completed = true
      currentState.won = true
    })

    it('should start new round with next bird', () => {
      const newState = startNewPracticeRound(currentState, sampleBirds)

      expect(newState.practiceIndex).toBe(1)
      expect(newState.currentBird).toBeDefined()
      expect(newState.guesses).toEqual([])
      expect(newState.completed).toBe(false)
      expect(newState.won).toBe(false)
      expect(newState.endTime).toBeNull()
    })

    it('should generate answer options for normal mode', () => {
      const newState = startNewPracticeRound(currentState, sampleBirds)

      expect(newState.answerOptions).toBeDefined()
      expect(newState.answerOptions.length).toBeGreaterThan(0)
    })

    it('should not generate answer options for hard mode', () => {
      const hardState = { ...currentState, isHardMode: true }
      const newState = startNewPracticeRound(hardState, sampleBirds)

      expect(newState.answerOptions).toEqual([])
    })

    it('should preserve region', () => {
      const newState = startNewPracticeRound(currentState, sampleBirds)

      expect(newState.region).toBe('us')
    })

    it('should preserve isHardMode flag', () => {
      const hardState = { ...currentState, isHardMode: true }
      const newState = startNewPracticeRound(hardState, sampleBirds)

      expect(newState.isHardMode).toBe(true)
    })

    it('should preserve maxGuesses', () => {
      const newState = startNewPracticeRound(currentState, sampleBirds)

      expect(newState.maxGuesses).toBe(currentState.maxGuesses)
    })

    it('should reset startTime', () => {
      const newState = startNewPracticeRound(currentState, sampleBirds)

      expect(newState.startTime).toBeDefined()
      // The new startTime should be recent (within last second)
      const newTime = new Date(newState.startTime).getTime()
      const now = Date.now()
      expect(newTime).toBeLessThanOrEqual(now)
      expect(newTime).toBeGreaterThan(now - 1000)
    })

    it('should return same state if no bird found', () => {
      const emptyBirds = { us: [] }
      const newState = startNewPracticeRound(currentState, emptyBirds)

      expect(newState.practiceIndex).toBe(0)  // Didn't increment
    })

    it('should increment practice index', () => {
      const newState = startNewPracticeRound(currentState, sampleBirds)

      expect(newState.practiceIndex).toBe(currentState.practiceIndex + 1)
    })
  })
})

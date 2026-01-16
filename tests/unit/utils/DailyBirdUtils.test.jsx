import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  hashBirdId,
  findBirdByHash,
  loadDailyBirdData,
  getTodaysBirdFromDaily,
  generateDailyEntry
} from '@/utils/DailyBirdUtils'
import { fetchWithRetry } from '@/utils/RetryUtils'
import { sampleBirds, sampleDailyData } from '../fixtures/sampleBirds'

// Mock RetryUtils
vi.mock('@/utils/RetryUtils', () => ({
  fetchWithRetry: vi.fn()
}))

describe('DailyBirdUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hashBirdId', () => {
    it('should hash bird ID correctly', () => {
      const hash = hashBirdId('amerob')

      expect(hash).toBeDefined()
      expect(typeof hash).toBe('string')
      expect(hash.length).toBe(8)
    })

    it('should produce consistent hashes', () => {
      const hash1 = hashBirdId('amerob')
      const hash2 = hashBirdId('amerob')

      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different IDs', () => {
      const hash1 = hashBirdId('amerob')
      const hash2 = hashBirdId('barswa')

      expect(hash1).not.toBe(hash2)
    })

    it('should handle special characters in bird ID', () => {
      const hash = hashBirdId('bird-with-dash')

      expect(hash).toBeDefined()
      expect(hash.length).toBe(8)
    })

    it('should handle empty string', () => {
      const hash = hashBirdId('')

      expect(hash).toBeDefined()
      expect(hash.length).toBe(8)
    })
  })

  describe('findBirdByHash', () => {
    it('should find bird by hash', () => {
      const bird = sampleBirds.us[0]
      const hash = hashBirdId(bird.id)
      const found = findBirdByHash(sampleBirds.us, hash)

      expect(found).toBeDefined()
      expect(found.id).toBe(bird.id)
      expect(found.name).toBe(bird.name)
    })

    it('should return null if hash not found', () => {
      const found = findBirdByHash(sampleBirds.us, 'invalidhash')

      expect(found).toBeNull()
    })

    it('should handle null birds array', () => {
      const found = findBirdByHash(null, 'hash')

      expect(found).toBeNull()
    })

    it('should handle null hash', () => {
      const found = findBirdByHash(sampleBirds.us, null)

      expect(found).toBeNull()
    })

    it('should handle undefined hash', () => {
      const found = findBirdByHash(sampleBirds.us, undefined)

      expect(found).toBeNull()
    })

    it('should be case insensitive for hash', () => {
      const bird = sampleBirds.us[0]
      const hash = hashBirdId(bird.id)
      const found = findBirdByHash(sampleBirds.us, hash.toUpperCase())

      expect(found).toBeDefined()
      expect(found.id).toBe(bird.id)
    })

    it('should handle empty birds array', () => {
      const hash = hashBirdId('amerob')
      const found = findBirdByHash([], hash)

      expect(found).toBeNull()
    })
  })

  describe('loadDailyBirdData', () => {
    it('should load daily data successfully', async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => sampleDailyData
      })

      const data = await loadDailyBirdData()

      expect(data).toEqual(sampleDailyData)
      expect(fetchWithRetry).toHaveBeenCalledWith('/data/daily.json', {}, { maxRetries: 3, baseDelay: 500 })
    })

    it('should handle HTTP errors', async () => {
      const errorResponse = { ok: false, status: 404, statusText: 'Not Found' }
      const error = new Error('HTTP 404: Not Found for /data/daily.json')
      fetchWithRetry.mockRejectedValueOnce(error)

      await expect(loadDailyBirdData()).rejects.toThrow('HTTP 404')
    })

    it('should validate data is array', async () => {
      const badResponse = { ok: true, json: async () => ({ not: 'an array' }) }
      fetchWithRetry.mockResolvedValueOnce(badResponse)

      await expect(loadDailyBirdData()).rejects.toThrow('Daily data must be an array')
    })

    it('should handle network errors', async () => {
      const networkError = new Error('Network error')
      fetchWithRetry.mockRejectedValueOnce(networkError)

      await expect(loadDailyBirdData()).rejects.toThrow('Network error')
    })

    it('should handle empty array', async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      const data = await loadDailyBirdData()

      expect(data).toEqual([])
      expect(Array.isArray(data)).toBe(true)
    })

    it('should handle malformed JSON', async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON')
        }
      })

      await expect(loadDailyBirdData()).rejects.toThrow()
    })
  })

  describe('getTodaysBirdFromDaily', () => {
    it('should get today\'s bird', async () => {
      const bird = sampleBirds.us[0]
      const hash = hashBirdId(bird.id)
      const dailyData = [{ date: '2025-12-27', region: 'us', answerHash: hash }]

      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => dailyData
      })

      const found = await getTodaysBirdFromDaily('us', sampleBirds.us, '2025-12-27')

      expect(found).toBeDefined()
      expect(found.id).toBe(bird.id)
      expect(found.name).toBe(bird.name)
    })

    it('should return null if no entry for date', async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => []
      })

      const found = await getTodaysBirdFromDaily('us', sampleBirds.us, '2025-12-27')

      expect(found).toBeNull()
    })

    it('should return null if no entry for region', async () => {
      const bird = sampleBirds.us[0]
      const hash = hashBirdId(bird.id)
      const dailyData = [{ date: '2025-12-27', region: 'eu', answerHash: hash }]

      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => dailyData
      })

      const found = await getTodaysBirdFromDaily('us', sampleBirds.us, '2025-12-27')

      expect(found).toBeNull()
    })

    it('should handle errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'))

      const found = await getTodaysBirdFromDaily('us', sampleBirds.us, '2025-12-27')

      expect(found).toBeNull()
    })

    it('should handle non-array daily data', async () => {
      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ not: 'an array' })
      })

      const found = await getTodaysBirdFromDaily('us', sampleBirds.us, '2025-12-27')

      expect(found).toBeNull()
    })

    it('should return null if bird hash not found', async () => {
      const dailyData = [{ date: '2025-12-27', region: 'us', answerHash: 'invalidhash' }]

      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => dailyData
      })

      const found = await getTodaysBirdFromDaily('us', sampleBirds.us, '2025-12-27')

      expect(found).toBeNull()
    })

    it('should match date and region exactly', async () => {
      const bird1 = sampleBirds.us[0]
      const bird2 = sampleBirds.us[1]
      const hash1 = hashBirdId(bird1.id)
      const hash2 = hashBirdId(bird2.id)

      const dailyData = [
        { date: '2025-12-27', region: 'us', answerHash: hash1 },
        { date: '2025-12-27', region: 'eu', answerHash: hash2 },
        { date: '2025-12-26', region: 'us', answerHash: hash2 }
      ]

      fetchWithRetry.mockResolvedValueOnce({
        ok: true,
        json: async () => dailyData
      })

      const found = await getTodaysBirdFromDaily('us', sampleBirds.us, '2025-12-27')

      expect(found).toBeDefined()
      expect(found.id).toBe(bird1.id)
    })
  })

  describe('generateDailyEntry', () => {
    it('should generate daily entry', () => {
      const entry = generateDailyEntry('2025-12-27', 'us', 'amerob')

      expect(entry.date).toBe('2025-12-27')
      expect(entry.region).toBe('us')
      expect(entry.answerHash).toBeDefined()
      expect(entry.answerHash.length).toBe(8)
    })

    it('should generate hash for bird ID', () => {
      const entry = generateDailyEntry('2025-12-27', 'us', 'amerob')
      const directHash = hashBirdId('amerob')

      expect(entry.answerHash).toBe(directHash)
    })

    it('should handle different dates', () => {
      const entry1 = generateDailyEntry('2025-12-27', 'us', 'amerob')
      const entry2 = generateDailyEntry('2025-12-26', 'us', 'amerob')

      expect(entry1.date).not.toBe(entry2.date)
      expect(entry1.answerHash).toBe(entry2.answerHash) // Same bird, same hash
    })

    it('should handle different regions', () => {
      const entry1 = generateDailyEntry('2025-12-27', 'us', 'amerob')
      const entry2 = generateDailyEntry('2025-12-27', 'eu', 'amerob')

      expect(entry1.region).not.toBe(entry2.region)
      expect(entry1.answerHash).toBe(entry2.answerHash) // Same bird, same hash
    })

    it('should handle different birds', () => {
      const entry1 = generateDailyEntry('2025-12-27', 'us', 'amerob')
      const entry2 = generateDailyEntry('2025-12-27', 'us', 'barswa')

      expect(entry1.answerHash).not.toBe(entry2.answerHash)
    })

    it('should have all required fields', () => {
      const entry = generateDailyEntry('2025-12-27', 'us', 'amerob')

      expect(entry).toHaveProperty('date')
      expect(entry).toHaveProperty('region')
      expect(entry).toHaveProperty('answerHash')
    })

    it('should generate consistent hashes for same bird', () => {
      const entry1 = generateDailyEntry('2025-12-27', 'us', 'amerob')
      const entry2 = generateDailyEntry('2025-12-27', 'us', 'amerob')

      expect(entry1.answerHash).toBe(entry2.answerHash)
    })
  })
})

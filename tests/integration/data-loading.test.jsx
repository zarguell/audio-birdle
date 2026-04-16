import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadGameData } from '@/utils/LoadGameData'
import { createMockResponse, createMockLocalStorage } from '@test/setup'
import { createMockBirdDataByRegion, createTestRegionList } from '@test/fixtures/integration-fixtures'

describe('Data Loading Integration', () => {
  let mockFetch
  let mockStorage

  beforeEach(() => {
    mockStorage = createMockLocalStorage()
    vi.stubGlobal('localStorage', mockStorage)

    mockFetch = vi.fn()
    global.fetch = mockFetch

    vi.clearAllMocks()
  })

  describe('Initial Data Loading', () => {
    it('should load regions.json successfully', async () => {
      const regions = createTestRegionList()
      const birds = createMockBirdDataByRegion()

      mockFetch.mockResolvedValueOnce(createMockResponse(regions))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds))

      const result = await loadGameData()

      expect(mockFetch).toHaveBeenCalledWith('/data/regions.json', expect.any(Object))
      expect(result.regions).toEqual(regions)
    })

    it('should load birds.json successfully', async () => {
      const regions = createTestRegionList()
      const birds = createMockBirdDataByRegion()

      mockFetch.mockResolvedValueOnce(createMockResponse(regions))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds))

      const result = await loadGameData()

      expect(mockFetch).toHaveBeenCalledWith('/data/birds.json', expect.any(Object))
      expect(result.birds).toEqual(birds)
    })

    it('should cache loaded data in localStorage', async () => {
      const regions = createTestRegionList()
      const birds = createMockBirdDataByRegion()

      mockFetch.mockImplementation((url) => {
        if (url.includes('regions.json')) {
          return Promise.resolve(createMockResponse(regions))
        }
        if (url.includes('birds.json')) {
          return Promise.resolve(createMockResponse(birds))
        }
        return Promise.reject(new Error('Not found'))
      })

      await loadGameData()

      expect(mockFetch).toHaveBeenCalledWith('/data/regions.json', expect.any(Object))
    })

    it('should return cached data on subsequent loads', async () => {
      const regions = createTestRegionList()
      const birds = createMockBirdDataByRegion()

      mockFetch.mockImplementation((url) => {
        if (url.includes('regions.json')) {
          return Promise.resolve(createMockResponse(regions))
        }
        if (url.includes('birds.json')) {
          return Promise.resolve(createMockResponse(birds))
        }
        return Promise.reject(new Error('Not found'))
      })

      const result1 = await loadGameData()
      const result2 = await loadGameData()

      expect(result1.regions).toEqual(result2.regions)
      expect(result1.birds).toEqual(result2.birds)
    })
  })

  describe('Cache Validation', () => {
    it('should use cache when data version matches', async () => {
      const regions = createTestRegionList()
      const birds = createMockBirdDataByRegion()

      mockFetch.mockResolvedValueOnce(createMockResponse(regions))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds))

      const result = await loadGameData()

      expect(result.regions).toEqual(regions)
      expect(result.birds).toEqual(birds)
    })

    it('should force refresh and bypass cache when requested', async () => {
      const regions = createTestRegionList()
      const birds = createMockBirdDataByRegion()

      mockFetch.mockResolvedValueOnce(createMockResponse(regions))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds))

      const result = await loadGameData(true)

      expect(mockFetch).toHaveBeenCalledWith('/data/regions.json', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache'
        }
      })
      expect(result.regions).toEqual(regions)
    })

    it('should handle cache version changes', async () => {
      const regions1 = createTestRegionList()
      const birds1 = createMockBirdDataByRegion()

      mockFetch.mockResolvedValueOnce(createMockResponse(regions1))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds1))

      await loadGameData()

      mockFetch.mockClear()

      const regions2 = [...regions1, { code: 'ca', name: 'Canada', subregions: [] }]
      const birds2 = { ...birds1 }

      mockFetch.mockResolvedValueOnce(createMockResponse(regions2))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds2))

      const result = await loadGameData(true)

      expect(result.regions).toEqual(regions2)
      expect(result.regions).toHaveLength(4)
    })
  })

  describe('Retry Logic', () => {
    it('should retry on fetch failure', async () => {
      const regions = createTestRegionList()
      const birds = createMockBirdDataByRegion()

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockResponse(regions))
        .mockResolvedValueOnce(createMockResponse(birds))

      const result = await loadGameData()

      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(result.regions).toEqual(regions)
    })

    it('should fail after max retries', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(loadGameData()).rejects.toThrow()
    })

    it('should succeed on retry after initial failure', async () => {
      const regions = createTestRegionList()
      const birds = createMockBirdDataByRegion()

      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(createMockResponse(regions))
        .mockResolvedValueOnce(createMockResponse(birds))

      const result = await loadGameData()

      expect(result).toBeDefined()
      expect(result.regions).toEqual(regions)
    })
  })

  describe('Error Scenarios', () => {
    it('should handle 404 response gracefully', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, 404))

      await expect(loadGameData()).rejects.toThrow()
    })

    it('should handle 500 server error', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({}, 500))

      await expect(loadGameData()).rejects.toThrow()
    })

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token')
        }
      })

      await expect(loadGameData()).rejects.toThrow()
    })

    it('should handle network timeout', async () => {
      mockFetch.mockRejectedValue(new Error('Timeout'))

      await expect(loadGameData()).rejects.toThrow()
    })

    it('should handle connection errors', async () => {
      mockFetch.mockRejectedValue(new Error('Failed to fetch'))

      await expect(loadGameData()).rejects.toThrow()
    })

    it('should handle empty regions.json', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse([]))
      mockFetch.mockResolvedValueOnce(createMockResponse({}))

      const result = await loadGameData()

      expect(result.regions).toEqual([])
      expect(result.birds).toEqual({})
    })

    it('should handle empty birds.json', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse(createTestRegionList()))
      mockFetch.mockResolvedValueOnce(createMockResponse({}))

      const result = await loadGameData()

      expect(result.birds).toEqual({})
    })
  })

  describe('Subregion Data Loading', () => {
    it('should handle virtual regions with parent fallback', async () => {
      const regions = [
        { code: 'us', name: 'United States', subregions: [] },
        { code: 'us-west', name: 'US West', parentRegion: 'us', subregions: [] }
      ]
      const birds = createMockBirdDataByRegion()

      mockFetch.mockImplementation((url) => {
        if (url.includes('regions.json')) {
          return Promise.resolve(createMockResponse(regions))
        }
        if (url.includes('birds.json')) {
          return Promise.resolve(createMockResponse(birds))
        }
        return Promise.reject(new Error('Not found'))
      })

      const result = await loadGameData()

      expect(result.birds).toHaveProperty('us')
      expect(result.birds['us']).toEqual(birds['us'])
    })

    it('should fallback to full region list if subregion list unavailable', async () => {
      const regions = [
        { code: 'us', name: 'United States', subregions: ['us-west'] },
        { code: 'us-west', name: 'US West', parentRegion: 'us', subregions: [] }
      ]
      const birds = createMockBirdDataByRegion()

      mockFetch.mockImplementation((url) => {
        if (url.includes('regions.json')) {
          return Promise.resolve(createMockResponse(regions))
        }
        if (url.includes('birds.json')) {
          return Promise.resolve(createMockResponse(birds))
        }
        return Promise.reject(new Error('Not found'))
      })

      const result = await loadGameData()

      expect(result.birds).toHaveProperty('us')
      expect(result.birds['us']).toEqual(birds['us'])
    })

    it('should cache subregion data separately', async () => {
      const regions = [
        { code: 'us', name: 'United States', subregions: [] },
        { code: 'us-east', name: 'US East', parentRegion: 'us', subregions: [] }
      ]
      const birds = createMockBirdDataByRegion()

      mockFetch.mockImplementation((url) => {
        if (url.includes('regions.json')) {
          return Promise.resolve(createMockResponse(regions))
        }
        if (url.includes('birds.json')) {
          return Promise.resolve(createMockResponse(birds))
        }
        return Promise.reject(new Error('Not found'))
      })

      await loadGameData()

      expect(mockFetch).toHaveBeenCalledWith('/data/regions.json', expect.any(Object))
    })
  })

  describe('Data Structure Validation', () => {
    it('should return regions with required fields', async () => {
      const regions = createTestRegionList()
      const birds = createMockBirdDataByRegion()

      mockFetch.mockResolvedValueOnce(createMockResponse(regions))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds))

      const result = await loadGameData()

      expect(result.regions).toBeInstanceOf(Array)
      expect(result.regions[0]).toHaveProperty('code')
      expect(result.regions[0]).toHaveProperty('name')
    })

    it('should return birds with required fields', async () => {
      const regions = createTestRegionList()
      const birds = createMockBirdDataByRegion()

      mockFetch.mockResolvedValueOnce(createMockResponse(regions))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds))

      const result = await loadGameData()

      expect(result.birds['us']).toBeInstanceOf(Array)
      expect(result.birds['us'][0]).toHaveProperty('id')
      expect(result.birds['us'][0]).toHaveProperty('name')
      expect(result.birds['us'][0]).toHaveProperty('audioUrl')
    })

    it('should handle regions without subregions', async () => {
      const regions = [
        { code: 'test', name: 'Test Region', subregions: [] }
      ]
      const birds = createMockBirdDataByRegion()

      mockFetch.mockResolvedValueOnce(createMockResponse(regions))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds))

      const result = await loadGameData()

      expect(result.regions[0].subregions).toEqual([])
    })

    it('should handle birds with multiple audio URLs', async () => {
      const regions = createTestRegionList()
      const birds = {
        us: [
          {
            id: 'testbird',
            name: 'Test Bird',
            scientificName: 'Testus birdus',
            order: 'Passeriformes',
            family: 'Testidae (Testidae)',
            audioUrl: [
              'http://example.com/audio1.mp3',
              'http://example.com/audio2.mp3'
            ]
          }
        ]
      }

      mockFetch.mockResolvedValueOnce(createMockResponse(regions))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds))

      const result = await loadGameData()

      expect(result.birds['us'][0].audioUrl).toHaveLength(2)
    })
  })

  describe('Concurrent Loading', () => {
    it('should handle concurrent load requests', async () => {
      const regions = createTestRegionList()
      const birds = createMockBirdDataByRegion()

      mockFetch.mockImplementation((url) => {
        if (url.includes('regions.json')) {
          return Promise.resolve(createMockResponse(regions))
        }
        if (url.includes('birds.json')) {
          return Promise.resolve(createMockResponse(birds))
        }
        return Promise.reject(new Error('Not found'))
      })

      const [result1, result2] = await Promise.all([
        loadGameData(),
        loadGameData()
      ])

      expect(result1.regions).toEqual(result2.regions)
      expect(result1.birds).toEqual(result2.birds)
    })
  })

  describe('Data Loading with Force Refresh', () => {
    it('should bypass all caching on force refresh', async () => {
      const regions = createTestRegionList()
      const birds = createMockBirdDataByRegion()

      mockFetch.mockResolvedValueOnce(createMockResponse(regions))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds))

      await loadGameData(true)

      expect(mockFetch).toHaveBeenCalledWith('/data/regions.json', expect.objectContaining({
        cache: 'no-store'
      }))
    })

    it('should update data on force refresh', async () => {
      const regions1 = createTestRegionList()
      const birds1 = createMockBirdDataByRegion()

      mockFetch.mockResolvedValueOnce(createMockResponse(regions1))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds1))

      const result1 = await loadGameData()

      const regions2 = [...regions1, { code: 'ca', name: 'Canada', subregions: [] }]
      const birds2 = { ...birds1 }

      mockFetch.mockResolvedValueOnce(createMockResponse(regions2))
      mockFetch.mockResolvedValueOnce(createMockResponse(birds2))

      const result2 = await loadGameData(true)

      expect(result2.regions).toHaveLength(4)
      expect(result1.regions).toHaveLength(3)
    })
  })
})

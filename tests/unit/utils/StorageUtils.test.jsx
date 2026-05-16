import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getStorage,
  setStorage,
  removeStorage,
  isStorageAvailable,
  getStorageKeys,
  clearStorage
} from '@/utils/StorageUtils'

describe('StorageUtils', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    vi.clearAllMocks()
    global.localStorage.getItem.mockClear()
    global.localStorage.setItem.mockClear()
    global.localStorage.removeItem.mockClear()
  })

  describe('isStorageAvailable', () => {
    it('should return true when localStorage is working', () => {
      const result = isStorageAvailable()

      expect(result).toBe(true)
      expect(global.localStorage.setItem).toHaveBeenCalledWith('__storage_test__', 'test')
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('__storage_test__')
    })

    it('should return false when localStorage is disabled', () => {
      global.localStorage.setItem.mockImplementationOnce(() => {
        throw new Error('localStorage disabled')
      })

      const result = isStorageAvailable()

      expect(result).toBe(false)
    })

    it('should return false when localStorage.removeItem fails', () => {
      global.localStorage.removeItem.mockImplementationOnce(() => {
        throw new Error('Remove failed')
      })

      const result = isStorageAvailable()

      expect(result).toBe(false)
    })
  })

  describe('getStorage (new API)', () => {
    it('should retrieve and parse stored data', () => {
      const testData = { key: 'value' }
      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(testData))

      const result = getStorage('test-key', {})

      expect(result).toEqual(testData)
      expect(global.localStorage.getItem).toHaveBeenCalledWith('test-key')
    })

    it('should return default value if no data stored', () => {
      global.localStorage.getItem.mockReturnValueOnce(null)

      const defaultValue = { default: true }
      const result = getStorage('test-key', defaultValue)

      expect(result).toEqual(defaultValue)
    })

    it('should handle JSON parse errors gracefully', () => {
      global.localStorage.getItem.mockReturnValueOnce('invalid json')

      const defaultValue = { default: true }
      const result = getStorage('test-key', defaultValue)

      expect(result).toEqual(defaultValue)
    })

    it('should handle QuotaExceededError on get', () => {
      const error = new Error('Quota exceeded')
      error.name = 'QuotaExceededError'
      global.localStorage.getItem.mockImplementationOnce(() => {
        throw error
      })

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = getStorage('test-key', 'default')

      expect(result).toBe('default')
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to get test-key: Quota exceeded')
      consoleWarnSpy.mockRestore()
    })

    it('should return success boolean for successful operations', () => {
      const testData = { key: 'value' }

      const result = setStorage('test-key', testData)

      expect(result).toBe(true)
    })

    it('should handle QuotaExceededError on set', () => {
      const error = new Error('Quota exceeded')
      error.name = 'QuotaExceededError'
      global.localStorage.setItem.mockImplementationOnce(() => {
        throw error
      })

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = setStorage('test-key', { data: 'test' })

      expect(result).toBe(false)
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to set test-key: Quota exceeded')
      consoleWarnSpy.mockRestore()
    })

    it('should remove storage successfully', () => {
      const result = removeStorage('test-key')

      expect(result).toBe(true)
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('test-key')
    })

    it('should return false when removeStorage fails', () => {
      global.localStorage.removeItem.mockImplementationOnce(() => {
        throw new Error('Remove error')
      })

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const result = removeStorage('test-key')

      expect(result).toBe(false)
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to remove test-key:', expect.any(Error))
      consoleWarnSpy.mockRestore()
    })
  })

  describe('getStorageKeys', () => {
    it('should return all localStorage keys', () => {
      Object.keys = vi.fn().mockReturnValue(['key1', 'key2', 'key3'])

      const keys = getStorageKeys()

      expect(keys).toEqual(['key1', 'key2', 'key3'])
      expect(Object.keys).toHaveBeenCalledWith(global.localStorage)
    })
  })

  describe('clearStorage', () => {
    it('should clear all app-specific keys', () => {
      Object.keys = vi.fn().mockReturnValue([
        'audio-birdle-region',
        'audio-birdle-game-state',
        'other-app-key'
      ])

      const cleared = clearStorage()

      expect(cleared).toBe(2)
      expect(global.localStorage.removeItem).toHaveBeenCalledTimes(2)
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('audio-birdle-region')
      expect(global.localStorage.removeItem).toHaveBeenCalledWith('audio-birdle-game-state')
    })

    it('should use custom prefix when provided', () => {
      Object.keys = vi.fn().mockReturnValue([
        'custom-prefix-key1',
        'custom-prefix-key2',
        'audio-birdle-key'
      ])

      const cleared = clearStorage('custom-prefix-')

      expect(cleared).toBe(2)
      expect(global.localStorage.removeItem).toHaveBeenCalledTimes(2)
    })

    it('should return 0 when getStorageKeys fails', () => {
      Object.keys = vi.fn().mockReturnValue([])

      const cleared = clearStorage()

      expect(cleared).toBe(0)
    })
  })



  describe('integration scenarios', () => {
    it('should store and retrieve data correctly with new API', () => {
      const testData = { user: 'test', score: 100 }

      setStorage('game-state', testData)

      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(testData))
      const retrieved = getStorage('game-state', {})

      expect(retrieved).toEqual(testData)
    })

    it('should handle update cycle with new API', () => {
      const data1 = { score: 100 }
      const data2 = { score: 200 }

      setStorage('score', data1)

      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(data1))
      const retrieved1 = getStorage('score', {})

      expect(retrieved1).toEqual(data1)

      setStorage('score', data2)

      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(data2))
      const retrieved2 = getStorage('score', {})

      expect(retrieved2).toEqual(data2)
    })

    it('should handle remove and default cycle with new API', () => {
      const testData = { value: 'test' }

      setStorage('temp-data', testData)
      removeStorage('temp-data')

      global.localStorage.getItem.mockReturnValueOnce(null)
      const retrieved = getStorage('temp-data', { default: true })

      expect(retrieved).toEqual({ default: true })
    })

    it('should preserve data types through storage cycle', () => {
      const original = {
        string: 'text',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        null: null,
        nested: { value: 123 }
      }

      setStorage('complex', original)

      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(original))
      const retrieved = getStorage('complex', {})

      expect(retrieved).toEqual(original)
      expect(typeof retrieved.string).toBe('string')
      expect(typeof retrieved.number).toBe('number')
      expect(typeof retrieved.boolean).toBe('boolean')
      expect(Array.isArray(retrieved.array)).toBe(true)
      expect(retrieved.null).toBeNull()
    })
  })
})

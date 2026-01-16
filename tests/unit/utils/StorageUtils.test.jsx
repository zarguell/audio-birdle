import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getStoredData,
  setStoredData,
  removeStoredData,
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

  describe('getStoredData (legacy API)', () => {
    it('should retrieve and parse stored data', () => {
      const testData = { key: 'value' }
      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(testData))

      const result = getStoredData('test-key', {})

      expect(result).toEqual(testData)
      expect(global.localStorage.getItem).toHaveBeenCalledWith('test-key')
    })

    it('should return default value if no data stored', () => {
      global.localStorage.getItem.mockReturnValueOnce(null)

      const defaultValue = { default: true }
      const result = getStoredData('test-key', defaultValue)

      expect(result).toEqual(defaultValue)
    })

    it('should return default value if stored value is empty string', () => {
      global.localStorage.getItem.mockReturnValueOnce('')

      const defaultValue = 'default'
      const result = getStoredData('test-key', defaultValue)

      expect(result).toBe(defaultValue)
    })

    it('should handle JSON parse errors gracefully', () => {
      global.localStorage.getItem.mockReturnValueOnce('invalid json')

      const defaultValue = { default: true }
      const result = getStoredData('test-key', defaultValue)

      expect(result).toEqual(defaultValue)
    })

    it('should parse numbers correctly', () => {
      global.localStorage.getItem.mockReturnValueOnce('42')

      const result = getStoredData('test-key', 0)

      expect(result).toBe(42)
      expect(typeof result).toBe('number')
    })

    it('should parse booleans correctly', () => {
      global.localStorage.getItem.mockReturnValueOnce('true')

      const result = getStoredData('test-key', false)

      expect(result).toBe(true)
      expect(typeof result).toBe('boolean')
    })

    it('should parse arrays correctly', () => {
      const testArray = [1, 2, 3]
      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(testArray))

      const result = getStoredData('test-key', [])

      expect(result).toEqual(testArray)
      expect(Array.isArray(result)).toBe(true)
    })

    it('should parse complex objects correctly', () => {
      const complexObject = {
        nested: { value: 123 },
        array: [1, 2, 3],
        string: 'test'
      }
      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(complexObject))

      const result = getStoredData('test-key', {})

      expect(result).toEqual(complexObject)
    })

    it('should handle null stored data', () => {
      global.localStorage.getItem.mockReturnValueOnce(null)

      const result = getStoredData('test-key', 'default')

      expect(result).toBe('default')
    })
  })

  describe('setStoredData (legacy API)', () => {
    it('should stringify and store data', () => {
      const testData = { key: 'value' }

      setStoredData('test-key', testData)

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData)
      )
    })

    it('should handle string values', () => {
      const testValue = 'test string'

      setStoredData('test-key', testValue)

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testValue)
      )
    })

    it('should handle number values', () => {
      const testValue = 42

      setStoredData('test-key', testValue)

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        '42'
      )
    })

    it('should handle null values', () => {
      setStoredData('test-key', null)

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        'null'
      )
    })

    it('should handle array values', () => {
      const testArray = [1, 2, 3]

      setStoredData('test-key', testArray)

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        '[1,2,3]'
      )
    })

    it('should handle storage errors gracefully', () => {
      global.localStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded')
      })

      expect(() => setStoredData('test-key', { data: 'test' })).not.toThrow()
    })

    it('should stringify complex objects correctly', () => {
      const complexObject = {
        nested: { value: 123 },
        array: [1, 2, 3]
      }

      setStoredData('test-key', complexObject)

      const stored = JSON.parse(global.localStorage.setItem.mock.calls[0][1])
      expect(stored).toEqual(complexObject)
    })
  })

  describe('removeStoredData (legacy API)', () => {
    it('should remove data from storage', () => {
      removeStoredData('test-key')

      expect(global.localStorage.removeItem).toHaveBeenCalledWith('test-key')
    })

    it('should handle removal errors gracefully', () => {
      global.localStorage.removeItem.mockImplementationOnce(() => {
        throw new Error('Remove error')
      })

      expect(() => removeStoredData('test-key')).not.toThrow()
    })

    it('should handle multiple removals', () => {
      removeStoredData('key1')
      removeStoredData('key2')
      removeStoredData('key3')

      expect(global.localStorage.removeItem).toHaveBeenCalledTimes(3)
      expect(global.localStorage.removeItem).toHaveBeenNthCalledWith(1, 'key1')
      expect(global.localStorage.removeItem).toHaveBeenNthCalledWith(2, 'key2')
      expect(global.localStorage.removeItem).toHaveBeenNthCalledWith(3, 'key3')
    })
  })

  describe('API backward compatibility', () => {
    it('should have getStoredData work identically to getStorage', () => {
      const testData = { value: 'test' }
      global.localStorage.getItem.mockReturnValueOnce(JSON.stringify(testData))

      const legacyResult = getStoredData('test-key', {})
      expect(legacyResult).toEqual(testData)
    })

    it('should have setStoredData work identically to setStorage', () => {
      const testData = { value: 'test' }

      setStoredData('test-key', testData)

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData)
      )
    })

    it('should have removeStoredData work identically to removeStorage', () => {
      removeStoredData('test-key')

      expect(global.localStorage.removeItem).toHaveBeenCalledWith('test-key')
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

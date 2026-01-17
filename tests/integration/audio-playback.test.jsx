import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAudioControls, getAudioSrc, isAudioUrlDead, markAudioUrlDead, loadDeadAudioUrlsCache, saveDeadAudioUrlsCache, clearDeadAudioUrlsCache } from '@/utils/AudioUtils'
import { createMockAudio, createMockLocalStorage } from '@test/setup'
import { createTestBird } from '@test/fixtures/integration-fixtures'

describe('Audio Playback Integration', () => {
  let mockAudio
  let mockStorage

  beforeEach(() => {
    mockAudio = createMockAudio()
    vi.stubGlobal('Audio', mockAudio)

    mockStorage = createMockLocalStorage()
    vi.stubGlobal('localStorage', mockStorage)
  })

  describe('Audio Control Creation', () => {
    it('should create audio controls for a bird with valid URLs', () => {
      const audioRef = { current: mockAudio() }
      const controls = createAudioControls(audioRef)

      expect(controls).toBeDefined()
      expect(controls.playAudio).toBeInstanceOf(Function)
      expect(controls.pauseAudio).toBeInstanceOf(Function)
      expect(controls.stopAudio).toBeInstanceOf(Function)
    })

    it('should play audio successfully', async () => {
      const audioInstance = mockAudio()
      audioInstance.play.mockResolvedValue(undefined)
      const audioRef = { current: audioInstance }
      const controls = createAudioControls(audioRef)

      const result = await controls.playAudio()

      expect(result).toBe(true)
      expect(audioInstance.play).toHaveBeenCalledTimes(1)
    })

    it('should pause audio', () => {
      const audioInstance = mockAudio()
      const audioRef = { current: audioInstance }
      const controls = createAudioControls(audioRef)

      controls.pauseAudio()

      expect(audioInstance.pause).toHaveBeenCalledTimes(1)
    })

    it('should stop audio (pause and reset currentTime)', () => {
      const audioInstance = mockAudio()
      audioInstance.currentTime = 5
      const audioRef = { current: audioInstance }
      const controls = createAudioControls(audioRef)

      controls.stopAudio()

      expect(audioInstance.pause).toHaveBeenCalledTimes(1)
      expect(audioInstance.currentTime).toBe(0)
    })

    it('should handle null audioRef gracefully', async () => {
      const audioRef = { current: null }
      const controls = createAudioControls(audioRef)

      const result = await controls.playAudio()

      expect(result).toBe(false)
    })
  })

  describe('getAudioSrc', () => {
    it('should return empty string for null audioUrlData', () => {
      expect(getAudioSrc(null)).toBe('')
    })

    it('should return single string for non-array format', () => {
      const url = 'http://example.com/audio.mp3'
      expect(getAudioSrc(url)).toBe(url)
    })

    it('should return first URL from array of strings', () => {
      const urls = ['http://example.com/audio1.mp3', 'http://example.com/audio2.mp3']
      expect(getAudioSrc(urls)).toBe('http://example.com/audio1.mp3')
    })

    it('should return URL from array of objects', () => {
      const urls = [{ url: 'http://example.com/audio.mp3' }]
      expect(getAudioSrc(urls)).toBe('http://example.com/audio.mp3')
    })

    it('should return second URL when index is specified', () => {
      const urls = ['http://example.com/audio1.mp3', 'http://example.com/audio2.mp3']
      expect(getAudioSrc(urls, 1)).toBe('http://example.com/audio2.mp3')
    })

    it('should return empty string for undefined index in array', () => {
      const urls = ['http://example.com/audio1.mp3']
      expect(getAudioSrc(urls, 5)).toBe('')
    })
  })

  describe('Dead URL Tracking', () => {
    it('should mark URL as dead and save to localStorage', () => {
      clearDeadAudioUrlsCache()

      const url = 'http://example.com/dead.mp3'
      markAudioUrlDead(url)

      expect(isAudioUrlDead(url)).toBe(true)
      const stored = mockStorage.getItem('audio-birdle-dead-audio-urls')
      const parsed = JSON.parse(stored)
      expect(parsed).toContain(url)
    })

    it('should track multiple dead URLs', () => {
      clearDeadAudioUrlsCache()

      const url1 = 'http://example.com/dead1.mp3'
      const url2 = 'http://example.com/dead2.mp3'

      markAudioUrlDead(url1)
      markAudioUrlDead(url2)

      expect(isAudioUrlDead(url1)).toBe(true)
      expect(isAudioUrlDead(url2)).toBe(true)

      const stored = mockStorage.getItem('audio-birdle-dead-audio-urls')
      const parsed = JSON.parse(stored)
      expect(parsed).toHaveLength(2)
      expect(parsed).toContain(url1)
      expect(parsed).toContain(url2)
    })

    it('should load dead URLs from localStorage on cache load', () => {
      clearDeadAudioUrlsCache()

      const urls = ['http://example.com/dead1.mp3', 'http://example.com/dead2.mp3']
      mockStorage.setItem('audio-birdle-dead-audio-urls', JSON.stringify(urls))

      loadDeadAudioUrlsCache()

      expect(isAudioUrlDead(urls[0])).toBe(true)
      expect(isAudioUrlDead(urls[1])).toBe(true)
    })

    it('should handle empty cache on load', () => {
      clearDeadAudioUrlsCache()
      mockStorage.setItem('audio-birdle-dead-audio-urls', JSON.stringify([]))

      loadDeadAudioUrlsCache()

      expect(isAudioUrlDead('http://example.com/any.mp3')).toBe(false)
    })

    it('should clear dead URL cache', () => {
      const url = 'http://example.com/dead.mp3'
      markAudioUrlDead(url)
      expect(isAudioUrlDead(url)).toBe(true)

      clearDeadAudioUrlsCache()

      expect(isAudioUrlDead(url)).toBe(false)
      expect(mockStorage.getItem('audio-birdle-dead-audio-urls')).toBeNull()
    })

    it('should clear cache between tests', () => {
      clearDeadAudioUrlsCache()
      expect(isAudioUrlDead('any-url')).toBe(false)
    })
  })

  describe('Audio Error Scenarios', () => {
    it('should handle audio.play() rejection (network error)', async () => {
      const audioInstance = mockAudio()
      audioInstance.play.mockRejectedValue(new Error('Network error'))
      const audioRef = { current: audioInstance }
      const controls = createAudioControls(audioRef)

      const result = await controls.playAudio()

      expect(result).toBe(false)
    })

    it('should handle audio.play() rejection (format error)', async () => {
      const audioInstance = mockAudio()
      audioInstance.play.mockRejectedValue(new Error('Format error'))
      const audioRef = { current: audioInstance }
      const controls = createAudioControls(audioRef)

      const result = await controls.playAudio()

      expect(result).toBe(false)
    })

    it('should handle missing audioUrl array gracefully', () => {
      const bird = createTestBird({ audioUrl: undefined })
      const src = getAudioSrc(bird.audioUrl)

      expect(src).toBe('')
    })

    it('should handle empty audioUrl array gracefully', () => {
      const bird = createTestBird({ audioUrl: [] })
      const src = getAudioSrc(bird.audioUrl)

      expect(src).toBe('')
    })

    it('should handle localStorage quota exceeded when tracking dead URLs', () => {
      const originalSetItem = mockStorage.setItem
      mockStorage.setItem = vi.fn(() => {
        throw new DOMException('QuotaExceededError')
      })

      expect(() => {
        markAudioUrlDead('http://example.com/dead.mp3')
      }).not.toThrow()

      mockStorage.setItem = originalSetItem
    })
  })

  describe('Audio State Management', () => {
    it('should handle volume changes', () => {
      const audioInstance = mockAudio()
      audioInstance.volume = 0.5
      const audioRef = { current: audioInstance }

      expect(audioInstance.volume).toBe(0.5)

      audioInstance.volume = 1.0
      expect(audioInstance.volume).toBe(1.0)
    })

    it('should track currentTime during playback simulation', () => {
      const audioInstance = mockAudio()
      audioInstance.currentTime = 0
      const audioRef = { current: audioInstance }

      expect(audioInstance.currentTime).toBe(0)

      audioInstance.currentTime = 5
      expect(audioInstance.currentTime).toBe(5)
    })

    it('should handle multiple play/pause cycles', async () => {
      const audioInstance = mockAudio()
      audioInstance.play.mockResolvedValue(undefined)
      const audioRef = { current: audioInstance }
      const controls = createAudioControls(audioRef)

      await controls.playAudio()
      expect(audioInstance.play).toHaveBeenCalledTimes(1)

      controls.pauseAudio()
      expect(audioInstance.pause).toHaveBeenCalledTimes(1)

      await controls.playAudio()
      expect(audioInstance.play).toHaveBeenCalledTimes(2)
    })
  })
})

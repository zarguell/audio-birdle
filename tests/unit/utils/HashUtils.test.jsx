import { describe, it, expect } from 'vitest'
import { hashString, createSeededRandom, deterministicShuffle, randomShuffle } from '@/utils/HashUtils'

// Expected hash values for consistency verification
// These MUST match Python implementation exactly
const EXPECTED_HASHES = {
  '': '00000000',
  'test': '00364492',
  'amerob-birdle-salt-2025': '104c723e',
  'barswa-birdle-salt-2025': '4060c5e0',
  'bird-with-dash-birdle-salt-2025': 'f0e934a5',
  'TESTBIRD-birdle-salt-2025': '0391253f',
  'mallar3-birdle-salt-2025': '1f16a85c',
  'hoomer-birdle-salt-2025': '5cf9cfd8'
}

describe('HashUtils', () => {
  describe('hashString', () => {
    it('should return "00000000" for empty string', () => {
      const hash = hashString('')
      expect(hash).toBe('00000000')
    })

    it('should return 8-character string', () => {
      const hash = hashString('test')
      expect(hash).toHaveLength(8)
    })

    it('should return lowercase hexadecimal', () => {
      const hash = hashString('TEST')
      expect(hash).toMatch(/^[0-9a-f]{8}$/)
    })

    it('should be zero-padded to 8 characters', () => {
      // Test case where hash would be less than 8 chars without padding
      const hash1 = hashString('test')
      expect(hash1).toHaveLength(8)
      expect(hash1[0]).toMatch(/[0-9a-f]/) // First char should be hex, not undefined

      // Test with input that produces small hash value
      const hash2 = hashString('a')
      expect(hash2).toHaveLength(8)
    })

    it('should be deterministic - same input produces same output', () => {
      const input = 'consistent-input'
      const hash1 = hashString(input)
      const hash2 = hashString(input)
      const hash3 = hashString(input)

      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })

    it('should produce different hashes for different inputs', () => {
      const inputs = ['input1', 'input2', 'input3', 'input4']
      const hashes = inputs.map(input => hashString(input))

      // All hashes should be different
      expect(new Set(hashes).size).toBe(inputs.length)
    })

    it('should match expected hash values for test vectors', () => {
      Object.entries(EXPECTED_HASHES).forEach(([input, expected]) => {
        const hash = hashString(input)
        expect(hash).toBe(expected)
      })
    })

    it('should handle special characters', () => {
      const specialInputs = [
        'bird-with-dash',
        'bird_with_underscore',
        'bird.with.dot',
        'bird@symbol',
        'bird space'
      ]

      specialInputs.forEach(input => {
        const hash = hashString(input)
        expect(hash).toHaveLength(8)
        expect(hash).toMatch(/^[0-9a-f]{8}$/)
      })
    })

    it('should handle unicode characters', () => {
      const unicodeInputs = ['日本語', '한글', 'русский', '🐦']

      unicodeInputs.forEach(input => {
        const hash = hashString(input)
        expect(hash).toHaveLength(8)
        expect(hash).toMatch(/^[0-9a-f]{8}$/)
      })
    })

    it('should handle long strings', () => {
      const longString = 'a'.repeat(10000)
      const hash = hashString(longString)

      expect(hash).toHaveLength(8)
      expect(hash).toMatch(/^[0-9a-f]{8}$/)
    })

    it('should produce consistent hashes across multiple calls', () => {
      const input = 'consistency-test'
      const iterations = 100
      const hashes = []

      for (let i = 0; i < iterations; i++) {
        hashes.push(hashString(input))
      }

      // All hashes should be identical
      expect(new Set(hashes).size).toBe(1)
    })

    it('should distribute hashes evenly across hash space', () => {
      // Generate hashes for 1000 sequential inputs
      const hashes = []
      for (let i = 0; i < 1000; i++) {
        hashes.push(hashString(`input-${i}`))
      }

      // Check uniqueness (should have very few collisions if any)
      const uniqueHashes = new Set(hashes)
      const collisionRate = (hashes.length - uniqueHashes.size) / hashes.length

      // Collision rate should be very low (< 1%)
      expect(collisionRate).toBeLessThan(0.01)
    })

    it('should handle case sensitivity', () => {
      const hash1 = hashString('Bird')
      const hash2 = hashString('bird')
      const hash3 = hashString('BIRD')

      // All should be different (case-sensitive)
      expect(hash1).not.toBe(hash2)
      expect(hash2).not.toBe(hash3)
      expect(hash1).not.toBe(hash3)
    })

    it('should produce expected hash for sample bird IDs', () => {
      // Test actual bird IDs that might be used in production
      const birdIds = [
        'amerob',
        'barswa',
        'mallar3',
        'hoomer',
        'rufhum'
      ]

      const SECRET_SALT = 'birdle-salt-2025'

      birdIds.forEach(birdId => {
        const combined = `${birdId}-${SECRET_SALT}`
        const hash = hashString(combined)

        expect(hash).toHaveLength(8)
        expect(hash).toMatch(/^[0-9a-f]{8}$/)
      })
    })
  })

  describe('createSeededRandom', () => {
    it('should produce deterministic output for same seed', () => {
      const rand1 = createSeededRandom(42);
      const rand2 = createSeededRandom(42);
      const results1 = Array.from({ length: 10 }, () => rand1());
      const results2 = Array.from({ length: 10 }, () => rand2());
      expect(results1).toEqual(results2);
    });

    it('should produce different output for different seeds', () => {
      const rand1 = createSeededRandom(42);
      const rand2 = createSeededRandom(99);
      const r1 = rand1();
      const r2 = rand2();
      expect(r1).not.toBe(r2);
    });

    it('should produce values between 0 and 1', () => {
      const rand = createSeededRandom(42);
      for (let i = 0; i < 100; i++) {
        const val = rand();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });
  });

  describe('deterministicShuffle', () => {
    it('should shuffle array deterministically', () => {
      const input = [1, 2, 3, 4, 5];
      const result1 = deterministicShuffle(input, 42);
      const result2 = deterministicShuffle(input, 42);
      expect(result1).toEqual(result2);
    });

    it('should contain same elements after shuffle', () => {
      const input = [1, 2, 3, 4, 5];
      const result = deterministicShuffle(input, 42);
      expect(result.sort()).toEqual(input.sort());
    });

    it('should not mutate original array', () => {
      const input = [1, 2, 3, 4, 5];
      const copy = [...input];
      deterministicShuffle(input, 42);
      expect(input).toEqual(copy);
    });
  });

  describe('randomShuffle', () => {
    it('should contain same elements after shuffle', () => {
      const input = [1, 2, 3, 4, 5];
      const result = randomShuffle(input);
      expect(result.sort()).toEqual(input.sort());
    });
  });

  describe('hashString consistency with Python', () => {
    it('should match Python implementation for empty string', () => {
      // Python: hash_bird_id('') returns '216da62a'
      // For just the string part without salt:
      // This test verifies the core hashString function
      const hash = hashString('')
      expect(hash).toBe('00000000')
    })

    it('should match Python implementation for sample inputs', () => {
      // These values must match Python hash_string() output
      const testCases = [
        { input: 'test', expected: '00364492' },
        { input: 'hello', expected: '05e918d2' },
        { input: 'world', expected: '06c11b92' }
      ]

      testCases.forEach(({ input, expected }) => {
        const hash = hashString(input)
        expect(hash).toBe(expected)
      })
    })
  })
})

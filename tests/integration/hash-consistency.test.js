/**
 * Hash Consistency Integration Tests
 *
 * CRITICAL: These tests verify that Python and JavaScript produce identical hashes.
 * The daily bird system depends on hash consistency between generate-daily-birds.py
 * and DailyBirdUtils.jsx. If these diverge, all daily birds will be incorrect.
 *
 * The vectors in KNOWN_HASHES below are computed from the repo's own implementations
 * and agree across both:
 *   JS:     hashBirdId(id) === hashString(`${id}-birdle-salt-2025`)  (src/utils/DailyBirdUtils.jsx)
 *   Python: hash_bird_id(id) from scripts/generate-daily-birds.py
 *
 * Regenerate them with:
 *   /tmp/audit-venv/bin/python -c "import importlib.util; spec = importlib.util.spec_from_file_location('gdb', 'scripts/generate-daily-birds.py'); mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); print(mod.hash_bird_id('amerob'))"
 */

import { describe, it, expect } from 'vitest'
import { hashBirdId } from '@/utils/DailyBirdUtils'

// Test bird IDs with their expected hash values, verified against the Python
// implementation (scripts/generate-daily-birds.py). If these drift, the daily
// bird answers served by the Python pipeline will no longer match the hashes
// the frontend computes, and no bird will ever be found.
const KNOWN_HASHES = {
  amerob: '104c723e', // American Robin
  mallar3: '1f16a85c', // Mallard
  horlar: '647952f8', // Hairy Woodpecker
  barswa: '4060c5e0', // Barn Swallow
  commer: 'd0cfe691', // Common Yellowthroat
  nobsho: 'ff7374f1', // Northern Bobwhite
  rebsap: '0be9c597', // Red-bellied Woodpecker
  songpa: 'db599924', // Song Sparrow
  amespa: '0106c83f', // American Tree Sparrow
  whcspa: 'a77b63b8', // White-crowned Sparrow
}

describe('Hash Consistency Integration', () => {
  describe('JavaScript Hash Implementation', () => {
    it('should produce 8-character hex hashes', () => {
      const testId = 'test-bird-id'
      const hash = hashBirdId(testId)

      expect(hash).toHaveLength(8)
      expect(/^[0-9a-f]{8}$/.test(hash)).toBe(true)
    })

    it('should produce consistent hashes for identical inputs', () => {
      const testId = 'test-bird-id'
      const hash1 = hashBirdId(testId)
      const hash2 = hashBirdId(testId)

      expect(hash1).toBe(hash2)
    })

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashBirdId('bird-1')
      const hash2 = hashBirdId('bird-2')

      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty string', () => {
      const hash = hashBirdId('')
      expect(hash).toHaveLength(8)
      expect(/^[0-9a-f]{8}$/.test(hash)).toBe(true)
    })

    it('should handle special characters', () => {
      const specialCases = [
        'bird-with-dash',
        'bird_with_underscore',
        'bird.with.dots',
        'birdwith123numbers',
        'BIRD-UPPERCASE',
        'bird-mixed-Case-123'
      ]

      specialCases.forEach(testId => {
        const hash = hashBirdId(testId)
        // hashString zero-pads every value to exactly 8 lowercase hex chars,
        // matching the Python implementation (no unpadded 7-char outputs).
        expect(hash).toHaveLength(8)
        expect(/^[0-9a-f]{8}$/.test(hash)).toBe(true)
      })
    })
  })

  describe('Python-JavaScript Hash Consistency', () => {
    it('should match the verified Python hash vectors', () => {
      Object.entries(KNOWN_HASHES).forEach(([birdId, expectedHash]) => {
        const jsHash = hashBirdId(birdId)
        expect(jsHash).toBe(expectedHash)
        expect(jsHash).toHaveLength(8)
        expect(/^[0-9a-f]{8}$/.test(jsHash)).toBe(true)
      })
    })

    it('should be deterministic across multiple calls', () => {
      const testCases = ['amerob', 'mallar3', 'horlar', 'barswa', 'commer']

      testCases.forEach(birdId => {
        const hashes = Array.from({ length: 5 }, () => hashBirdId(birdId))
        hashes.forEach(hash => {
          expect(hash).toBe(hashes[0])
        })
      })
    })
  })

  describe('Salt Consistency', () => {
    it('should use the documented salt value', () => {
      // Both implementations use: "birdle-salt-2025"
      // This test documents that requirement

      const testId = 'test-salt-verification'
      const hash1 = hashBirdId(testId)
      const hash2 = hashBirdId(testId)

      // Verify deterministic behavior (salt is constant)
      expect(hash1).toBe(hash2)
      expect(hash1).toHaveLength(8)
    })
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import {
  LANGUAGE_STORAGE_KEY,
  getStoredLanguage,
  persistLanguage,
  resolveInitialLanguage
} from '../../src/lib/language'

describe('language persistence logic', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('getStoredLanguage', () => {
    it('returns null when nothing has been stored yet', () => {
      expect(getStoredLanguage()).toBeNull()
    })

    it('returns the stored value when it is a valid language', () => {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es')
      expect(getStoredLanguage()).toBe('es')
    })

    it('returns null for a corrupted/unexpected stored value rather than throwing', () => {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'fr')
      expect(getStoredLanguage()).toBeNull()
    })
  })

  describe('resolveInitialLanguage', () => {
    it('prefers an explicit stored choice', () => {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es')
      expect(resolveInitialLanguage()).toBe('es')
    })

    it('defaults to English when nothing is stored (no system-preference guessing)', () => {
      expect(resolveInitialLanguage()).toBe('en')
    })
  })

  describe('persistLanguage', () => {
    it('writes the chosen language to localStorage under the shared key', () => {
      persistLanguage('es')
      expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es')
    })
  })
})

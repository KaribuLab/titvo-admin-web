import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  THEME_STORAGE_KEY,
  applyThemeClass,
  getStoredTheme,
  getSystemTheme,
  persistTheme,
  resolveInitialTheme
} from '../../src/lib/theme'

function mockMatchMedia (prefersDark: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-color-scheme: dark)' && prefersDark,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
}

describe('theme persistence logic', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  describe('getStoredTheme', () => {
    it('returns null when nothing has been stored yet', () => {
      expect(getStoredTheme()).toBeNull()
    })

    it('returns the stored value when it is a valid theme', () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
      expect(getStoredTheme()).toBe('dark')
    })

    it('returns null for a corrupted/unexpected stored value rather than throwing', () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme')
      expect(getStoredTheme()).toBeNull()
    })
  })

  describe('getSystemTheme', () => {
    it('reports dark when the OS prefers a dark color scheme', () => {
      mockMatchMedia(true)
      expect(getSystemTheme()).toBe('dark')
    })

    it('reports light when the OS does not prefer dark', () => {
      mockMatchMedia(false)
      expect(getSystemTheme()).toBe('light')
    })
  })

  describe('resolveInitialTheme', () => {
    it('prefers an explicit stored choice over the system preference', () => {
      mockMatchMedia(true)
      window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
      expect(resolveInitialTheme()).toBe('light')
    })

    it('falls back to the system preference when nothing is stored', () => {
      mockMatchMedia(true)
      expect(resolveInitialTheme()).toBe('dark')
    })
  })

  describe('persistTheme', () => {
    it('writes the chosen theme to localStorage under the shared key', () => {
      persistTheme('dark')
      expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    })
  })

  describe('applyThemeClass', () => {
    it('adds the "dark" class to <html> for the dark theme', () => {
      applyThemeClass('dark')
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })

    it('removes the "dark" class from <html> for the light theme', () => {
      document.documentElement.classList.add('dark')
      applyThemeClass('light')
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })
})

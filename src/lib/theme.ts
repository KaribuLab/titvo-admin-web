export type Theme = 'light' | 'dark'

/**
 * Standard "class"-based dark mode strategy (Tailwind's `dark:` variant),
 * adapted for plain Vite/React without Next.js — this repo has no
 * `next-themes` dependency, this is a small hand-rolled equivalent.
 * `ThemeProvider` (see `src/components/ThemeProvider.tsx`) is the only
 * consumer of these pure functions; kept separate and dependency-free so
 * the persistence/resolution logic is unit-testable without rendering.
 */
export const THEME_STORAGE_KEY = 'titvo-theme'

function isTheme (value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}

/** `null` when nothing has been stored yet, or the stored value isn't a recognized theme. */
export function getStoredTheme (): Theme | null {
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isTheme(raw) ? raw : null
}

/**
 * The OS/browser's `prefers-color-scheme`, as a fallback when the user
 * hasn't chosen explicitly. Same `matchMedia` feature-check
 * `usePrefersReducedMotion` already uses — some test/embedding
 * environments (jsdom here included) don't implement `matchMedia` at all.
 */
export function getSystemTheme (): Theme {
  if (typeof window.matchMedia !== 'function') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** An explicit stored choice always wins over the system preference. */
export function resolveInitialTheme (): Theme {
  return getStoredTheme() ?? getSystemTheme()
}

export function persistTheme (theme: Theme): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}

/** Toggles the `dark` class on `<html>` — the hook Tailwind's `dark:` variant and shadcn's CSS variables both key off. */
export function applyThemeClass (theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

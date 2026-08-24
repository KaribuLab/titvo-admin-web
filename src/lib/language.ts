export type Language = 'en' | 'es'

/**
 * Persistence/resolution for the UI language toggle — same pattern as
 * `src/lib/theme.ts` (pure, unit-testable functions; `LanguageProvider`
 * is the only consumer that touches React state). Unlike theme, there is
 * no reliable "system preference" signal worth trusting for language
 * (`navigator.language` is often wrong for what the user actually wants
 * the UI in), so the default is always `'en'` unless the user has
 * explicitly chosen otherwise.
 */
export const LANGUAGE_STORAGE_KEY = 'titvo-language'

function isLanguage (value: string | null): value is Language {
  return value === 'en' || value === 'es'
}

/** `null` when nothing has been stored yet, or the stored value isn't a recognized language. */
export function getStoredLanguage (): Language | null {
  const raw = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  return isLanguage(raw) ? raw : null
}

/** An explicit stored choice always wins; otherwise defaults to English. */
export function resolveInitialLanguage (): Language {
  return getStoredLanguage() ?? 'en'
}

export function persistLanguage (language: Language): void {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
}

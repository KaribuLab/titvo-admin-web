import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import i18n from '../i18n/config'
import { persistLanguage, resolveInitialLanguage, type Language } from '../lib/language'

interface LanguageContextValue {
  language: Language
  toggleLanguage: () => void
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

/**
 * Same shape as `ThemeProvider`: pure persistence/resolution logic lives in
 * `src/lib/language.ts`, this component just wires it to `i18next`'s
 * `changeLanguage` (which every `useTranslation()` call in the app already
 * subscribes to via `react-i18next`, so a toggle here re-renders the whole
 * tree with the new language with no prop drilling).
 *
 * The `useEffect` below (mirroring `ThemeProvider`'s own `applyThemeClass`
 * effect) is required, not optional: `i18next` is one GLOBAL singleton
 * shared across the whole app (and across every test in the same process).
 * Without it, a `LanguageProvider` that mounts fresh with `language: 'en'`
 * (e.g. resolved from cleared storage) would leave the actual `i18next`
 * instance on whatever language a PREVIOUS mount last switched it to —
 * `useTranslation()` reads i18next directly, not this component's local
 * state, so the two could silently disagree.
 */
export function LanguageProvider ({ children }: { children: React.ReactNode }): React.ReactElement {
  const [language, setLanguage] = useState<Language>(() => resolveInitialLanguage())

  useEffect(() => {
    void i18n.changeLanguage(language)
  }, [language])

  const toggleLanguage = useCallback((): void => {
    setLanguage(previous => {
      const next: Language = previous === 'en' ? 'es' : 'en'
      persistLanguage(next)
      return next
    })
  }, [])

  return <LanguageContext.Provider value={{ language, toggleLanguage }}>{children}</LanguageContext.Provider>
}

export function useLanguage (): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

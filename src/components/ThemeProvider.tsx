import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { applyThemeClass, persistTheme, resolveInitialTheme, type Theme } from '../lib/theme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

/**
 * Standard shadcn/next-themes-style "class" dark mode strategy, adapted for
 * plain Vite/React (no Next.js, no `next-themes` dependency — see
 * `src/lib/theme.ts` for the pure, unit-tested persistence/resolution
 * logic this component just wires up to a class on `<html>`).
 */
export function ThemeProvider ({ children }: { children: React.ReactNode }): React.ReactElement {
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme())

  useEffect(() => {
    applyThemeClass(theme)
  }, [theme])

  const toggleTheme = useCallback((): void => {
    setTheme(previous => {
      const next: Theme = previous === 'dark' ? 'light' : 'dark'
      persistTheme(next)
      return next
    })
  }, [])

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme (): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

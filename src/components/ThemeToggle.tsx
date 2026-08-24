import React from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from './ui/button'
import { useTheme } from './ThemeProvider'

/** Sun/moon toggle button — lives in the sidebar footer next to the user menu. */
export function ThemeToggle (): React.ReactElement {
  const { theme, toggleTheme } = useTheme()
  const nextLabel = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

import * as React from 'react'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from '@/components/ThemeProvider'

/**
 * App-wide toast viewport (shadcn's sonner recipe) — the single toast
 * system for the whole app, replacing the old motion-based
 * `ToastViewport`/`FlashMessage` pair. Themed off the SAME `ThemeProvider`
 * every authenticated page already renders via `AppShell`, so a toast
 * fired right after a dark-mode navigation never flashes the wrong palette.
 */
function Toaster ({ ...props }: ToasterProps): React.ReactElement {
  const { theme } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground'
        }
      }}
      {...props}
    />
  )
}

export { Toaster }

import React from 'react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { AppSidebar } from './AppSidebar'
import { ThemeProvider } from './ThemeProvider'
import { LanguageProvider } from './LanguageProvider'
import { LanguageToggle } from './LanguageToggle'
import { ThemeToggle } from './ThemeToggle'
import { SidebarInset, SidebarProvider, SidebarTrigger } from './ui/sidebar'
import { Separator } from './ui/separator'
import { Toaster } from './ui/sonner'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { reducedMotionTransition, springSmooth } from '../lib/motion'

export interface AppShellProps {
  children: React.ReactNode
}

/**
 * Shared authenticated-screen chrome — the shadcn collapsible Sidebar shell
 * (see `src/components/ui/sidebar.tsx` and `AppSidebar`), replacing the
 * previous top pill-nav `AppHeader`. `SidebarProvider` persists
 * expanded/collapsed state (cookie) and switches to an overlay `Sheet` on
 * small viewports on its own — no separate mobile nav to maintain.
 *
 * `ThemeProvider` and `LanguageProvider` live here (every authenticated
 * screen renders its own `AppShell`, there's no single top-level wrapper in
 * `App.tsx`) so every page gets dark-mode support and the theme/language
 * toggles in the top header for free.
 */
export function AppShell ({ children }: AppShellProps): React.ReactElement {
  const reducedMotion = usePrefersReducedMotion()
  const { t } = useTranslation()

  return (
    <ThemeProvider>
      <LanguageProvider>
        <Toaster position='top-right' richColors closeButton />
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className='flex h-14 shrink-0 items-center gap-2 border-b px-4 lg:px-6'>
              <div className='flex flex-1 items-center gap-2'>
                <SidebarTrigger className='-ml-1' />
                <Separator orientation='vertical' className='mx-2 h-4' />
                <span className='text-base font-medium'>{t('appShell.title')}</span>
              </div>
              <div className='flex items-center gap-1'>
                <LanguageToggle />
                <ThemeToggle />
              </div>
            </header>
            <motion.main
              className='flex-1 overflow-y-auto p-4 lg:p-6'
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reducedMotion ? reducedMotionTransition : springSmooth}
            >
              {import.meta.env.VITE_TITVO_LAB === 'true' && (
                <div className='mb-5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm'>
                  {t('analysis.labDescription')} <code>titvo scan</code> · {t('analysis.labRefresh')}
                  <p className='mt-1 text-xs text-muted-foreground'>{t('analysis.statusExplanation')}</p>
                </div>
              )}
              {children}
            </motion.main>
          </SidebarInset>
        </SidebarProvider>
      </LanguageProvider>
    </ThemeProvider>
  )
}

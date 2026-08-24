import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 768

/**
 * Tracks whether the viewport is at/below the mobile breakpoint, live (not
 * just at mount) — drives the Sidebar's switch from a fixed collapsible
 * panel to an overlay `Sheet` (see `src/components/ui/sidebar.tsx`).
 * Named/shaped like this repo's other viewport hooks (`useScrolled`,
 * `usePrefersReducedMotion`) rather than shadcn's default `use-mobile.tsx`.
 */
export function useIsMobile (): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const handleChange = (): void => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    handleChange()
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return isMobile
}

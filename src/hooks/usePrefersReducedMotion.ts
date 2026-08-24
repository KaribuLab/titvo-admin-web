import { useEffect, useState } from 'react'

/**
 * Tracks `prefers-reduced-motion: reduce` live (not just at mount), so
 * spring/slide transitions can be swapped for a plain opacity cross-fade
 * per Apple Design §14. Components read this instead of hardcoding motion.
 */
export function usePrefersReducedMotion (): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handleChange = (): void => setReduced(query.matches)
    query.addEventListener('change', handleChange)
    return () => query.removeEventListener('change', handleChange)
  }, [])

  return reduced
}

import { useEffect, useState } from 'react'

/**
 * True once the document has scrolled past `threshold`. Drives the
 * header's scroll-edge fade (Apple Design §12 — a soft shadow that
 * appears once there is content underneath, instead of a permanent
 * hard 1px border).
 */
export function useScrolled (threshold = 4): boolean {
  const [scrolled, setScrolled] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.scrollY > threshold : false
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleScroll = (): void => setScrolled(window.scrollY > threshold)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  return scrolled
}

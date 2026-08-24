import type { Transition } from 'motion/react'

/**
 * Shared spring presets (Apple Design §4). Critically damped
 * (`bounce: 0`) by default — this is an admin tool, restraint over
 * flourish. Nothing here carries gesture/momentum physics; there is
 * nothing to drag in this app.
 */

/** Default for most UI: button press, field focus, list enter/exit. */
export const springSnappy: Transition = { type: 'spring', bounce: 0, duration: 0.3 }

/** Slightly slower — page-level and sheet-like surfaces (the form card, toasts). */
export const springSmooth: Transition = { type: 'spring', bounce: 0, duration: 0.42 }

/** Plain cross-fade fallback used whenever `prefers-reduced-motion: reduce` is set. */
export const reducedMotionTransition: Transition = { duration: 0.15, ease: 'linear' }

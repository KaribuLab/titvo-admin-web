/**
 * Router-state payload used to hand a one-shot toast message across a
 * `navigate(...)` call (e.g. "API key created." after a create screen
 * redirects back to its list). Rendered via `sonner`'s `toast[type](text)`
 * — see `src/components/ui/sonner.tsx` for the single app-wide toast
 * viewport this is consumed by.
 */
export interface FlashMessage {
  type: 'success' | 'error'
  text: string
}

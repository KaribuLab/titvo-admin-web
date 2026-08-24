import '@testing-library/jest-dom/vitest'
// Initializes the global i18next instance once for the whole test run — in
// production this happens via `main.tsx` importing `src/i18n/config`
// before `<App/>` renders, but tests import individual page components
// directly (bypassing `main.tsx`), and not every page renders `AppShell`
// (which would otherwise pull this in transitively via `LanguageProvider`)
// — `LoginPage` is the one screen with no sidebar chrome. Importing it
// here once, globally, is more robust than depending on each page's own
// import graph to happen to reach it.
import '../src/i18n/config'

// jsdom doesn't implement ResizeObserver — several Radix primitives we now
// use (Checkbox's internal size tracking, Select's viewport, etc.) call it
// unconditionally on mount.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe (): void {}
    unobserve (): void {}
    disconnect (): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver
}

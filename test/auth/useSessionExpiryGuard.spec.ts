import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSessionExpiryGuard } from '../../src/auth/useSessionExpiryGuard'

describe('useSessionExpiryGuard', () => {
  it('redirects immediately when there are no unsaved changes', () => {
    const onRedirect = vi.fn()
    const { result } = renderHook(() => useSessionExpiryGuard({ hasUnsavedChanges: false, onRedirect }))

    act(() => {
      result.current.handleSessionExpired()
    })

    expect(onRedirect).toHaveBeenCalledTimes(1)
    expect(result.current.noticeVisible).toBe(false)
  })

  it('does NOT redirect immediately when there are unsaved changes — surfaces a notice instead (spec: no silent discard)', () => {
    const onRedirect = vi.fn()
    const { result } = renderHook(() => useSessionExpiryGuard({ hasUnsavedChanges: true, onRedirect }))

    act(() => {
      result.current.handleSessionExpired()
    })

    expect(onRedirect).not.toHaveBeenCalled()
    expect(result.current.noticeVisible).toBe(true)
  })

  it('acknowledgeAndRedirect() dismisses the notice and redirects on demand', () => {
    const onRedirect = vi.fn()
    const { result } = renderHook(() => useSessionExpiryGuard({ hasUnsavedChanges: true, onRedirect }))

    act(() => {
      result.current.handleSessionExpired()
    })
    expect(result.current.noticeVisible).toBe(true)

    act(() => {
      result.current.acknowledgeAndRedirect()
    })

    expect(result.current.noticeVisible).toBe(false)
    expect(onRedirect).toHaveBeenCalledTimes(1)
  })

  it('re-evaluates hasUnsavedChanges at the moment of expiry, not at hook-mount time', () => {
    const onRedirect = vi.fn()
    let hasUnsavedChanges = false
    const { result, rerender } = renderHook(
      ({ hasUnsavedChanges }: { hasUnsavedChanges: boolean }) =>
        useSessionExpiryGuard({ hasUnsavedChanges, onRedirect }),
      { initialProps: { hasUnsavedChanges } }
    )

    hasUnsavedChanges = true
    rerender({ hasUnsavedChanges })

    act(() => {
      result.current.handleSessionExpired()
    })

    expect(onRedirect).not.toHaveBeenCalled()
    expect(result.current.noticeVisible).toBe(true)
  })
})

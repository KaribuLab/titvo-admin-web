import { useCallback, useRef, useState } from 'react'

export interface UseSessionExpiryGuardOptions {
  /** Whether the caller currently has unsaved input (e.g. an open edit form). */
  hasUnsavedChanges: boolean
  /** Invoked to actually navigate away (e.g. `navigate('/login')`). */
  onRedirect: () => void
}

export interface UseSessionExpiryGuardResult {
  /** True while a "your session expired" notice should be shown instead of an immediate redirect. */
  noticeVisible: boolean
  /**
   * Call this when a 401 is discovered (e.g. from an API call made by the
   * consuming screen). Per spec, an expiring session must never silently
   * discard unsaved input — if `hasUnsavedChanges` is true this surfaces a
   * notice and withholds the redirect until the user acknowledges it via
   * `acknowledgeAndRedirect()`. With nothing unsaved, it redirects at once.
   */
  handleSessionExpired: () => void
  /** User acknowledged the notice — dismiss it and redirect now. */
  acknowledgeAndRedirect: () => void
}

/**
 * Mechanism/pattern for the "session expiring mid-form" requirement
 * (spec: admin-console-web / Session Expiry Mid-Form Protection). This
 * batch wires the reusable hook and proves it in isolation; the actual
 * config-edit form that owns `hasUnsavedChanges` ships in a later batch.
 */
export function useSessionExpiryGuard (options: UseSessionExpiryGuardOptions): UseSessionExpiryGuardResult {
  const [noticeVisible, setNoticeVisible] = useState(false)
  // hasUnsavedChanges must be read fresh at the moment of expiry, not
  // captured at mount — keep it in a ref updated on every render.
  const hasUnsavedChangesRef = useRef(options.hasUnsavedChanges)
  hasUnsavedChangesRef.current = options.hasUnsavedChanges
  const onRedirectRef = useRef(options.onRedirect)
  onRedirectRef.current = options.onRedirect

  const handleSessionExpired = useCallback((): void => {
    if (hasUnsavedChangesRef.current) {
      setNoticeVisible(true)
      return
    }
    onRedirectRef.current()
  }, [])

  const acknowledgeAndRedirect = useCallback((): void => {
    setNoticeVisible(false)
    onRedirectRef.current()
  }, [])

  return { noticeVisible, handleSessionExpired, acknowledgeAndRedirect }
}

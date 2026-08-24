import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../api/client'

export type Role = 'admin' | 'member'

export interface AuthUser {
  userId: string
  email: string
  role: Role
}

/**
 * `loading`   — initial `GET /api/admin/auth/me` in flight.
 * `authenticated` — valid session, `user` populated.
 * `unauthenticated` — no session (never logged in, explicit logout, or a
 *   401 discovered with nothing at stake).
 * `expired` — was authenticated, then a 401 was discovered mid-session via
 *   `notifySessionExpired()`. Distinct from `unauthenticated` on purpose:
 *   consumers (e.g. an in-progress edit form) can render a warning instead
 *   of `ProtectedRoute` performing a silent redirect — see spec's
 *   "session expiry mid-form must not discard unsaved input" requirement
 *   and `useSessionExpiryGuard`.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'expired'

interface MeResponse {
  user_id: string
  email: string
  role: Role
}

interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  notifySessionExpired: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function toAuthUser (response: MeResponse): AuthUser {
  return { userId: response.user_id, email: response.email, role: response.role }
}

export function AuthProvider ({ children }: { children: React.ReactNode }): React.ReactElement {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    let cancelled = false

    apiFetch<MeResponse>('/api/admin/auth/me')
      .then(response => {
        if (cancelled) return
        setUser(toAuthUser(response))
        setStatus('authenticated')
      })
      .catch(() => {
        if (cancelled) return
        setUser(null)
        setStatus('unauthenticated')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
      const response = await apiFetch<MeResponse>('/api/admin/auth/login', {
        method: 'POST',
        body: { email, password }
      })
      setUser(toAuthUser(response))
      setStatus('authenticated')
    } catch (error) {
      // Never present a stale/unauthenticated state as authenticated on
      // failure. The caller (LoginPage) is responsible for surfacing the
      // error message — this hook only preserves session-state integrity.
      setUser(null)
      if (status !== 'expired') {
        setStatus('unauthenticated')
      }
      throw error
    }
  }, [status])

  const logout = useCallback(async (): Promise<void> => {
    try {
      await apiFetch('/api/admin/auth/logout', { method: 'POST' })
    } catch {
      // Logout is idempotent by design (mirrors the BFF's own handler,
      // which always clears the cookie even on repository failure) — the
      // client-side session state must always clear too.
    } finally {
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [])

  const notifySessionExpired = useCallback((): void => {
    setUser(null)
    setStatus('expired')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, notifySessionExpired }),
    [status, user, login, logout, notifySessionExpired]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth (): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

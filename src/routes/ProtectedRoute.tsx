import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/**
 * Route guard (spec: admin-console-web / Authenticated Session Handling).
 * Uses `GET /api/admin/auth/me` (via `AuthProvider`) — a 401 means "not
 * logged in", never a client-side inspection of the (invisible) session
 * cookie. Renders nothing while the initial check is in flight, to avoid
 * a redirect flash before the real status is known.
 */
export function ProtectedRoute (): React.ReactElement | null {
  const { status } = useAuth()

  if (status === 'loading') {
    return null
  }

  if (status === 'unauthenticated' || status === 'expired') {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

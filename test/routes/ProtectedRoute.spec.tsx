import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '../../src/routes/ProtectedRoute'
import { AuthProvider } from '../../src/auth/AuthContext'
import { ApiError } from '../../src/api/client'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})

import { apiFetch } from '../../src/api/client'

function renderAt (path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Protected Dashboard</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('redirects an unauthenticated visitor navigating to a protected screen to /login (spec: admin-console-web)', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(401, 'unauthorized'))

    renderAt('/')

    await waitFor(() => expect(screen.getByText('Login Page')).toBeInTheDocument())
    expect(screen.queryByText('Protected Dashboard')).not.toBeInTheDocument()
  })

  it('renders the protected content once the session is confirmed authenticated', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'admin' })

    renderAt('/')

    await waitFor(() => expect(screen.getByText('Protected Dashboard')).toBeInTheDocument())
  })

  it('does not redirect while the initial session check is still loading', () => {
    vi.mocked(apiFetch).mockReturnValueOnce(new Promise(() => {})) // never resolves

    renderAt('/')

    expect(screen.queryByText('Login Page')).not.toBeInTheDocument()
    expect(screen.queryByText('Protected Dashboard')).not.toBeInTheDocument()
  })
})

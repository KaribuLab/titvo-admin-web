import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LoginPage } from '../../src/pages/LoginPage'
import { AuthProvider } from '../../src/auth/AuthContext'
import { ApiError } from '../../src/api/client'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})

import { apiFetch } from '../../src/api/client'

function renderLoginPage (): void {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<div>Protected Dashboard</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    // initial AuthProvider me() check — start each test unauthenticated
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(401, 'unauthorized'))
  })

  it('shows a clear error message on wrong credentials (spec: admin-auth)', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(401, 'invalid_credentials'))
    const user = userEvent.setup()

    renderLoginPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled())

    await user.type(screen.getByLabelText(/email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
  })

  it('navigates to the protected dashboard on successful login', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'admin' })
    const user = userEvent.setup()

    renderLoginPage()
    await waitFor(() => expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled())

    await user.type(screen.getByLabelText(/email/i), 'a@b.com')
    await user.type(screen.getByLabelText(/password/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText('Protected Dashboard')).toBeInTheDocument()
  })
})

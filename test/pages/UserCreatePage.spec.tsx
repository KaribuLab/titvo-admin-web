import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../src/auth/AuthContext'
import { ApiError } from '../../src/api/client'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})
vi.mock('../../src/api/users')

import { apiFetch } from '../../src/api/client'
import { createUser } from '../../src/api/users'
import { UserCreatePage } from '../../src/pages/UserCreatePage'

function renderAt (path: string, role: 'admin' | 'member' = 'admin'): void {
  vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'me', email: 'me@titvo.io', role })
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/users" element={<div>User List Page</div>} />
          <Route path="/users/new" element={<UserCreatePage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('UserCreatePage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(createUser).mockReset()
  })

  it('redirects a member session away from the form instead of rendering it', async () => {
    renderAt('/users/new', 'member')

    await waitFor(() => expect(screen.getByText('User List Page')).toBeInTheDocument())
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
  })

  it('defaults the role to member and submits email/password/role to createUser', async () => {
    vi.mocked(createUser).mockResolvedValueOnce({ userId: 'u2', email: 'new@titvo.io', role: 'member' })
    renderAt('/users/new')

    await screen.findByLabelText(/email/i)
    expect(screen.getByLabelText(/role/i)).toHaveValue('member')

    await userEvent.type(screen.getByLabelText(/email/i), 'new@titvo.io')
    await userEvent.type(screen.getByLabelText(/initial password/i), 'super-secret-1')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => expect(createUser).toHaveBeenCalledWith('new@titvo.io', 'super-secret-1', 'member'))
  })

  it('creates an admin user when the role select is changed to Admin', async () => {
    vi.mocked(createUser).mockResolvedValueOnce({ userId: 'u3', email: 'newadmin@titvo.io', role: 'admin' })
    renderAt('/users/new')

    await screen.findByLabelText(/email/i)
    await userEvent.type(screen.getByLabelText(/email/i), 'newadmin@titvo.io')
    await userEvent.type(screen.getByLabelText(/initial password/i), 'super-secret-1')
    await userEvent.selectOptions(screen.getByLabelText(/role/i), 'admin')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => expect(createUser).toHaveBeenCalledWith('newadmin@titvo.io', 'super-secret-1', 'admin'))
  })

  it('navigates back to the user list with a success flash after creating a user (no email/reveal step — the admin already knows the password they typed)', async () => {
    vi.mocked(createUser).mockResolvedValueOnce({ userId: 'u2', email: 'new@titvo.io', role: 'member' })
    renderAt('/users/new')

    await screen.findByLabelText(/email/i)
    await userEvent.type(screen.getByLabelText(/email/i), 'new@titvo.io')
    await userEvent.type(screen.getByLabelText(/initial password/i), 'super-secret-1')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => expect(screen.getByText('User List Page')).toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('surfaces a clear message when the email already exists (409)', async () => {
    vi.mocked(createUser).mockRejectedValueOnce(new ApiError(409, 'already_exists'))
    renderAt('/users/new')

    await screen.findByLabelText(/email/i)
    await userEvent.type(screen.getByLabelText(/email/i), 'dup@titvo.io')
    await userEvent.type(screen.getByLabelText(/initial password/i), 'super-secret-1')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i))
  })
})

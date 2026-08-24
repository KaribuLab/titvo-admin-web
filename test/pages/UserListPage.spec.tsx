import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../src/auth/AuthContext'
import { ApiError } from '../../src/api/client'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})
vi.mock('../../src/api/users')

import { apiFetch } from '../../src/api/client'
import { listUsers, updateUser } from '../../src/api/users'
import { UserListPage } from '../../src/pages/UserListPage'

function renderAsRole (role: 'admin' | 'member'): void {
  vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'me', email: 'me@titvo.io', role })
  render(
    <MemoryRouter>
      <AuthProvider>
        <UserListPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('UserListPage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(listUsers).mockReset()
    vi.mocked(updateUser).mockReset()
  })

  it('renders an empty-state message when no users exist', async () => {
    vi.mocked(listUsers).mockResolvedValueOnce([])

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText(/no users/i)).toBeInTheDocument())
  })

  it('lists email, role, and status for multiple users (spec: List beyond seed-admin)', async () => {
    vi.mocked(listUsers).mockResolvedValueOnce([
      { userId: 'seed', email: 'seed@titvo.io', role: 'admin', status: 'active' },
      { userId: 'u2', email: 'member@titvo.io', role: 'member', status: 'inactive' }
    ])

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('seed@titvo.io')).toBeInTheDocument())
    expect(screen.getByText('member@titvo.io')).toBeInTheDocument()
    expect(screen.getAllByText(/^admin$/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/^member$/i).length).toBeGreaterThan(0)
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('inactive')).toBeInTheDocument()
  })

  it('shows a "Create user" control and per-row actions for an admin session', async () => {
    vi.mocked(listUsers).mockResolvedValueOnce([
      { userId: 'seed', email: 'seed@titvo.io', role: 'admin', status: 'active' }
    ])

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('seed@titvo.io')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /create user/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /make member/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /deactivate/i })).toBeInTheDocument()
  })

  it('hides create and role/status controls entirely for a member session (spec: Write Access Control)', async () => {
    vi.mocked(listUsers).mockResolvedValueOnce([
      { userId: 'seed', email: 'seed@titvo.io', role: 'admin', status: 'active' }
    ])

    renderAsRole('member')

    await waitFor(() => expect(screen.getByText('seed@titvo.io')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /create user/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /make member/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument()
  })

  it('promotes a member to admin with a single click — no last-admin risk, no confirm needed', async () => {
    vi.mocked(listUsers).mockResolvedValue([
      { userId: 'u2', email: 'member@titvo.io', role: 'member', status: 'active' }
    ])
    vi.mocked(updateUser).mockResolvedValueOnce({ userId: 'u2', email: 'member@titvo.io', role: 'admin', status: 'active' })

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('member@titvo.io')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /make admin/i }))

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('u2', { role: 'admin' }))
  })

  it('reactivates an inactive user with a single click', async () => {
    vi.mocked(listUsers).mockResolvedValue([
      { userId: 'u2', email: 'member@titvo.io', role: 'member', status: 'inactive' }
    ])
    vi.mocked(updateUser).mockResolvedValueOnce({ userId: 'u2', email: 'member@titvo.io', role: 'member', status: 'active' })

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('member@titvo.io')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /reactivate/i }))

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('u2', { status: 'active' }))
  })

  it('requires a second explicit confirmation click before deactivating a user (destructive action)', async () => {
    vi.mocked(listUsers).mockResolvedValue([
      { userId: 'u2', email: 'member@titvo.io', role: 'member', status: 'active' }
    ])
    vi.mocked(updateUser).mockResolvedValueOnce({ userId: 'u2', email: 'member@titvo.io', role: 'member', status: 'inactive' })

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('member@titvo.io')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^deactivate$/i }))

    expect(updateUser).not.toHaveBeenCalled()
    const confirmButton = screen.getByRole('button', { name: /confirm deactivate/i })

    await userEvent.click(confirmButton)

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('u2', { status: 'inactive' }))
  })

  it('lets the admin cancel out of the deactivate confirmation without calling the API', async () => {
    vi.mocked(listUsers).mockResolvedValueOnce([
      { userId: 'u2', email: 'member@titvo.io', role: 'member', status: 'active' }
    ])

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('member@titvo.io')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^deactivate$/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('button', { name: /confirm deactivate/i })).not.toBeInTheDocument()
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('requires a second explicit confirmation click before demoting an admin to member', async () => {
    vi.mocked(listUsers).mockResolvedValue([
      { userId: 'u3', email: 'admin2@titvo.io', role: 'admin', status: 'active' }
    ])
    vi.mocked(updateUser).mockResolvedValueOnce({ userId: 'u3', email: 'admin2@titvo.io', role: 'member', status: 'active' })

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('admin2@titvo.io')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /make member/i }))

    expect(updateUser).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /confirm role change/i }))

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith('u3', { role: 'member' }))
  })

  it('surfaces the last-admin block with a clear message when deactivating the sole admin (spec: Deactivate last admin)', async () => {
    vi.mocked(listUsers).mockResolvedValue([
      { userId: 'seed', email: 'seed@titvo.io', role: 'admin', status: 'active' }
    ])
    vi.mocked(updateUser).mockRejectedValueOnce(new ApiError(409, 'last_admin'))

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('seed@titvo.io')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /^deactivate$/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm deactivate/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/last active admin/i))
    expect(screen.getByText('seed@titvo.io')).toBeInTheDocument()
  })

  it('surfaces the last-admin block with a clear message when de-admining the sole admin (spec: De-admin the last admin)', async () => {
    vi.mocked(listUsers).mockResolvedValue([
      { userId: 'seed', email: 'seed@titvo.io', role: 'admin', status: 'active' }
    ])
    vi.mocked(updateUser).mockRejectedValueOnce(new ApiError(409, 'last_admin'))

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('seed@titvo.io')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /make member/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm role change/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/last active admin/i))
    expect(screen.getByText('seed@titvo.io')).toBeInTheDocument()
  })

  it('surfaces a clear error message when listing fails, instead of a blank screen', async () => {
    vi.mocked(listUsers).mockRejectedValueOnce(new ApiError(500, undefined))

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})

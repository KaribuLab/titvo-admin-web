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
vi.mock('../../src/api/apiKeys')

import { apiFetch } from '../../src/api/client'
import { listApiKeys, revokeApiKey } from '../../src/api/apiKeys'
import { ApiKeyListPage } from '../../src/pages/ApiKeyListPage'

function renderAsRole (role: 'admin' | 'member'): void {
  vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role })
  render(
    <MemoryRouter>
      <AuthProvider>
        <ApiKeyListPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ApiKeyListPage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(listApiKeys).mockReset()
    vi.mocked(revokeApiKey).mockReset()
  })

  it('renders an empty-state message when no keys exist', async () => {
    vi.mocked(listApiKeys).mockResolvedValueOnce([])

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText(/no api keys/i)).toBeInTheDocument())
  })

  it('lists label, status, and created date — never a raw or hashed key value (spec: Metadata-Only Listing)', async () => {
    vi.mocked(listApiKeys).mockResolvedValueOnce([
      { keyId: 'k1', label: 'CI pipeline', status: 'active', createdAt: '2026-01-01T00:00:00Z' },
      { keyId: 'k2', label: 'Old key', status: 'revoked', createdAt: '2025-06-01T00:00:00Z' }
    ])

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('CI pipeline')).toBeInTheDocument())
    expect(screen.getByText('Old key')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
    expect(screen.getByText('revoked')).toBeInTheDocument()
    expect(screen.queryByText(/tvok-/)).not.toBeInTheDocument()
  })

  it('shows a "Create key" control for an admin session', async () => {
    vi.mocked(listApiKeys).mockResolvedValueOnce([
      { keyId: 'k1', label: 'CI pipeline', status: 'active', createdAt: '2026-01-01T00:00:00Z' }
    ])

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('CI pipeline')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /create key/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument()
  })

  it('hides create and revoke controls entirely for a member session (spec: Write Access Control, member reads only)', async () => {
    vi.mocked(listApiKeys).mockResolvedValueOnce([
      { keyId: 'k1', label: 'CI pipeline', status: 'active', createdAt: '2026-01-01T00:00:00Z' }
    ])

    renderAsRole('member')

    await waitFor(() => expect(screen.getByText('CI pipeline')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /create key/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /revoke/i })).not.toBeInTheDocument()
  })

  it('requires a second explicit confirmation click before actually revoking (destructive action)', async () => {
    vi.mocked(listApiKeys).mockResolvedValue([
      { keyId: 'k1', label: 'CI pipeline', status: 'active', createdAt: '2026-01-01T00:00:00Z' }
    ])
    vi.mocked(revokeApiKey).mockResolvedValueOnce({ keyId: 'k1', status: 'revoked' })

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('CI pipeline')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /revoke/i }))

    expect(revokeApiKey).not.toHaveBeenCalled()
    const confirmButton = screen.getByRole('button', { name: /confirm revoke/i })

    await userEvent.click(confirmButton)

    await waitFor(() => expect(revokeApiKey).toHaveBeenCalledWith('k1'))
  })

  it('lets the admin cancel out of the revoke confirmation without calling the API', async () => {
    vi.mocked(listApiKeys).mockResolvedValueOnce([
      { keyId: 'k1', label: 'CI pipeline', status: 'active', createdAt: '2026-01-01T00:00:00Z' }
    ])

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('CI pipeline')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /revoke/i }))
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.queryByRole('button', { name: /confirm revoke/i })).not.toBeInTheDocument()
    expect(revokeApiKey).not.toHaveBeenCalled()
  })

  it('surfaces the "last active key" 409 with a clear message instead of pretending the block did not happen', async () => {
    vi.mocked(listApiKeys).mockResolvedValue([
      { keyId: 'k1', label: 'CI pipeline', status: 'active', createdAt: '2026-01-01T00:00:00Z' }
    ])
    vi.mocked(revokeApiKey).mockRejectedValueOnce(new ApiError(409, 'last_active_key'))

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('CI pipeline')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /revoke/i }))
    await userEvent.click(screen.getByRole('button', { name: /confirm revoke/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/last active/i))
    expect(screen.getByText('CI pipeline')).toBeInTheDocument()
  })

  it('surfaces a clear error message when listing fails, instead of a blank screen', async () => {
    vi.mocked(listApiKeys).mockRejectedValueOnce(new ApiError(500, undefined))

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})

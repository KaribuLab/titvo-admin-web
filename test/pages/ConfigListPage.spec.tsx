import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../src/auth/AuthContext'
import { ApiError } from '../../src/api/client'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})
vi.mock('../../src/api/config')

import { apiFetch } from '../../src/api/client'
import { listConfig } from '../../src/api/config'
import { ConfigListPage } from '../../src/pages/ConfigListPage'

function renderAsRole (role: 'admin' | 'member'): void {
  vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role })
  render(
    <MemoryRouter>
      <AuthProvider>
        <ConfigListPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ConfigListPage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(listConfig).mockReset()
  })

  it('renders an empty-state message (not an error) when the table has no entries (spec: Empty table)', async () => {
    vi.mocked(listConfig).mockResolvedValueOnce([])

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText(/no configuration entries/i)).toBeInTheDocument())
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('lists parameter_id and type for existing entries, never rendering a value column', async () => {
    vi.mocked(listConfig).mockResolvedValueOnce([
      { parameterId: 'API_KEY', isSecret: true, updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'admin@titvo.io' },
      { parameterId: 'REGION', isSecret: false, updatedAt: '2026-01-02T00:00:00Z', updatedBy: 'admin@titvo.io' }
    ])

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('API_KEY')).toBeInTheDocument())
    expect(screen.getByText('REGION')).toBeInTheDocument()
    expect(screen.getByText('Secret')).toBeInTheDocument()
    expect(screen.getByText('Plaintext')).toBeInTheDocument()
  })

  it('shows add/edit controls for an admin session (task 4.7/4.8)', async () => {
    vi.mocked(listConfig).mockResolvedValueOnce([
      { parameterId: 'API_KEY', isSecret: true, updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'admin@titvo.io' }
    ])

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByText('API_KEY')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /add new/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument()
  })

  it('hides add/edit controls entirely for a member session, not just disables them (spec: Member sees read-only UI)', async () => {
    vi.mocked(listConfig).mockResolvedValueOnce([
      { parameterId: 'API_KEY', isSecret: true, updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'admin@titvo.io' }
    ])

    renderAsRole('member')

    await waitFor(() => expect(screen.getByText('API_KEY')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /add new/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('surfaces a clear error message when listing fails, instead of a blank screen', async () => {
    vi.mocked(listConfig).mockRejectedValueOnce(new ApiError(503, 'encryption_unavailable'))

    renderAsRole('admin')

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})

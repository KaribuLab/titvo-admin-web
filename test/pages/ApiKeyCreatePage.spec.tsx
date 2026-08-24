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
vi.mock('../../src/api/apiKeys')

import { apiFetch } from '../../src/api/client'
import { createApiKey } from '../../src/api/apiKeys'
import { ApiKeyCreatePage } from '../../src/pages/ApiKeyCreatePage'

function renderAt (path: string, role: 'admin' | 'member' = 'admin'): void {
  vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role })
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/api-keys" element={<div>API Key List Page</div>} />
          <Route path="/api-keys/new" element={<ApiKeyCreatePage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ApiKeyCreatePage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(createApiKey).mockReset()
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('redirects a member session away from the form instead of rendering it', async () => {
    renderAt('/api-keys/new', 'member')

    await waitFor(() => expect(screen.getByText('API Key List Page')).toBeInTheDocument())
    expect(screen.queryByLabelText(/label/i)).not.toBeInTheDocument()
  })

  it('submits a label and shows the one-time raw key reveal on success', async () => {
    vi.mocked(createApiKey).mockResolvedValueOnce({ keyId: 'k1', label: 'CI pipeline', apiKey: 'tvok-secretvalue1234' })
    renderAt('/api-keys/new')

    await screen.findByLabelText(/label/i)
    await userEvent.type(screen.getByLabelText(/label/i), 'CI pipeline')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => expect(createApiKey).toHaveBeenCalledWith('CI pipeline'))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('tvok-secretvalue1234')).toBeInTheDocument()
  })

  it('surfaces a submit error without showing the modal when creation fails', async () => {
    vi.mocked(createApiKey).mockRejectedValueOnce(new ApiError(400, 'invalid_request'))
    renderAt('/api-keys/new')

    await screen.findByLabelText(/label/i)
    await userEvent.type(screen.getByLabelText(/label/i), 'x')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('never renders the raw key anywhere after the modal is dismissed, and navigates back to the list', async () => {
    vi.mocked(createApiKey).mockResolvedValueOnce({ keyId: 'k1', label: 'CI pipeline', apiKey: 'tvok-secretvalue1234' })
    renderAt('/api-keys/new')

    await screen.findByLabelText(/label/i)
    await userEvent.type(screen.getByLabelText(/label/i), 'CI pipeline')
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }))

    await screen.findByRole('dialog')
    expect(screen.getByText('tvok-secretvalue1234')).toBeInTheDocument()

    await userEvent.click(screen.getByLabelText(/i've copied this key/i))
    await userEvent.click(screen.getByRole('button', { name: /^done$/i }))

    await waitFor(() => expect(screen.getByText('API Key List Page')).toBeInTheDocument())
    expect(screen.queryByText('tvok-secretvalue1234')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.body.innerHTML).not.toContain('tvok-secretvalue1234')
  })
})

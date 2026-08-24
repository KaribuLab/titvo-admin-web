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
vi.mock('../../src/api/config')

import { apiFetch } from '../../src/api/client'
import { addConfig, getConfig, updateConfig } from '../../src/api/config'
import { ConfigFormPage } from '../../src/pages/ConfigFormPage'

function renderAt (path: string, role: 'admin' | 'member' = 'admin'): void {
  vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role })
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/config" element={<div>Config List Page</div>} />
          <Route path="/config/new" element={<ConfigFormPage />} />
          <Route path="/config/:parameterId/edit" element={<ConfigFormPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ConfigFormPage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(addConfig).mockReset()
    vi.mocked(getConfig).mockReset()
    vi.mocked(updateConfig).mockReset()
  })

  describe('add mode', () => {
    it('submits a new key and navigates back to the list on success', async () => {
      vi.mocked(addConfig).mockResolvedValueOnce(undefined)
      renderAt('/config/new')

      await screen.findByLabelText(/key/i)
      await userEvent.type(screen.getByLabelText(/key/i), 'NEW_KEY')
      await userEvent.type(screen.getByLabelText(/value/i), 'hello')
      await userEvent.click(screen.getByRole('button', { name: /add/i }))

      await waitFor(() => expect(addConfig).toHaveBeenCalledWith({ parameterId: 'NEW_KEY', value: 'hello', isSecret: false }))
      await waitFor(() => expect(screen.getByText('Config List Page')).toBeInTheDocument())
    })

    it('surfaces "this key already exists" on a 409 without navigating away (spec: Add with existing key)', async () => {
      vi.mocked(addConfig).mockRejectedValueOnce(new ApiError(409, 'already_exists'))
      renderAt('/config/new')

      await screen.findByLabelText(/key/i)
      await userEvent.type(screen.getByLabelText(/key/i), 'API_KEY')
      await userEvent.type(screen.getByLabelText(/value/i), 'x')
      await userEvent.click(screen.getByRole('button', { name: /add/i }))

      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/this key already exists/i))
      expect(screen.queryByText('Config List Page')).not.toBeInTheDocument()
    })

    it('marks the value as secret when the secret toggle is checked', async () => {
      vi.mocked(addConfig).mockResolvedValueOnce(undefined)
      renderAt('/config/new')

      await screen.findByLabelText(/key/i)
      await userEvent.type(screen.getByLabelText(/key/i), 'API_KEY')
      await userEvent.type(screen.getByLabelText(/value/i), 'x')
      await userEvent.click(screen.getByLabelText(/secret/i))
      await userEvent.click(screen.getByRole('button', { name: /add/i }))

      await waitFor(() => expect(addConfig).toHaveBeenCalledWith({ parameterId: 'API_KEY', value: 'x', isSecret: true }))
    })
  })

  describe('edit mode', () => {
    it('loads the existing key read-only and never pre-fills a secret value (spec: Secret Values Are Write-Only)', async () => {
      vi.mocked(getConfig).mockResolvedValueOnce({ parameterId: 'API_KEY', isSecret: true, updatedAt: '2026-01-01T00:00:00Z' })
      renderAt('/config/API_KEY/edit')

      await waitFor(() => expect(getConfig).toHaveBeenCalledWith('API_KEY'))
      expect(await screen.findByText('API_KEY')).toBeInTheDocument()
      const valueInput = screen.getByLabelText(/value/i) as HTMLInputElement
      expect(valueInput.value).toBe('')
    })

    it('pre-fills the existing value for a plaintext parameter (not sensitive)', async () => {
      vi.mocked(getConfig).mockResolvedValueOnce({ parameterId: 'REGION', isSecret: false, value: 'us-east-1', updatedAt: '2026-01-02T00:00:00Z' })
      renderAt('/config/REGION/edit')

      const valueInput = await screen.findByLabelText(/value/i) as HTMLInputElement
      expect(valueInput.value).toBe('us-east-1')
    })

    it('submits an explicit update with only the new value, never flipping is_secret', async () => {
      vi.mocked(getConfig).mockResolvedValueOnce({ parameterId: 'API_KEY', isSecret: true, updatedAt: '2026-01-01T00:00:00Z' })
      vi.mocked(updateConfig).mockResolvedValueOnce(undefined)
      renderAt('/config/API_KEY/edit')

      const valueInput = await screen.findByLabelText(/value/i)
      await userEvent.type(valueInput, 'new-secret-value')
      await userEvent.click(screen.getByRole('button', { name: /update/i }))

      await waitFor(() => expect(updateConfig).toHaveBeenCalledWith('API_KEY', { value: 'new-secret-value' }))
      await waitFor(() => expect(screen.getByText('Config List Page')).toBeInTheDocument())
    })
  })

  it('redirects a member session away from the form instead of rendering write controls (tasks 4.7/4.8)', async () => {
    renderAt('/config/new', 'member')

    await waitFor(() => expect(screen.getByText('Config List Page')).toBeInTheDocument())
    expect(screen.queryByLabelText(/key/i)).not.toBeInTheDocument()
  })
})

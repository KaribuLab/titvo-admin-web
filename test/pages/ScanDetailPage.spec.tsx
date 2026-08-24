import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../src/auth/AuthContext'
import { ApiError } from '../../src/api/client'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})
vi.mock('../../src/api/scans')

import { apiFetch } from '../../src/api/client'
import { getScan } from '../../src/api/scans'
import { ScanDetailPage } from '../../src/pages/ScanDetailPage'

function renderAtScan (scanId: string): void {
  vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'member' })
  render(
    <MemoryRouter initialEntries={[`/scans/${scanId}`]}>
      <AuthProvider>
        <Routes>
          <Route path="/scans/:scanId" element={<ScanDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('ScanDetailPage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(getScan).mockReset()
  })

  it('shows the full scan record for a completed scan (spec: View scan detail)', async () => {
    vi.mocked(getScan).mockResolvedValueOnce({
      scanId: 's1',
      repositoryId: 'r1',
      status: 'SUCCESS',
      source: 'github',
      branch: 'main',
      args: { depth: 1 },
      result: { findings: 0 },
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:05:00Z'
    })

    renderAtScan('s1')

    await waitFor(() => expect(getScan).toHaveBeenCalledWith('s1'))
    expect(await screen.findByText('r1')).toBeInTheDocument()
    expect(screen.getByText('github')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText(/success/i)).toBeInTheDocument()
    expect(screen.getByText(/"depth": 1/)).toBeInTheDocument()
    expect(screen.getByText(/"findings": 0/)).toBeInTheDocument()
  })

  it('renders IN_PROGRESS as a distinct state, not "unknown" (spec: Scan Status Fidelity)', async () => {
    vi.mocked(getScan).mockResolvedValueOnce({ scanId: 's2', repositoryId: 'r1', status: 'IN_PROGRESS' })

    renderAtScan('s2')

    expect(await screen.findByText(/in progress/i)).toBeInTheDocument()
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument()
  })

  it('surfaces a clear "no longer exists" message on a 404, instead of a blank screen', async () => {
    vi.mocked(getScan).mockRejectedValueOnce(new ApiError(404, 'not_found'))

    renderAtScan('gone')

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/no longer exists/i)).toBeInTheDocument()
  })
})

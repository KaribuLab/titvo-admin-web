import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../src/auth/AuthContext'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})
vi.mock('../../src/api/repos')
vi.mock('../../src/api/scans')
vi.mock('../../src/api/apiKeys')
vi.mock('../../src/api/users')

import { apiFetch } from '../../src/api/client'
import { listRepos } from '../../src/api/repos'
import { listScansForRepo } from '../../src/api/scans'
import { listApiKeys } from '../../src/api/apiKeys'
import { listUsers } from '../../src/api/users'
import { DashboardPage } from '../../src/pages/DashboardPage'

function renderDashboard (): void {
  vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'admin' })
  render(
    <MemoryRouter>
      <AuthProvider>
        <DashboardPage />
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(listRepos).mockReset()
    vi.mocked(listScansForRepo).mockReset()
    vi.mocked(listApiKeys).mockReset()
    vi.mocked(listUsers).mockReset()
  })

  it('renders the repo status hero with a tile per connected repo, linking to its latest scan (spec: hero mosaic)', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'titvo/rag-indexer', lastScan: { scanId: 's1', status: 'SUCCESS', createdAt: '2026-01-02T00:00:00Z' } }
    ])
    vi.mocked(listScansForRepo).mockResolvedValueOnce([
      { scanId: 's1', status: 'SUCCESS', createdAt: '2026-01-02T00:00:00Z' }
    ])
    vi.mocked(listApiKeys).mockResolvedValueOnce([])
    vi.mocked(listUsers).mockResolvedValueOnce([])

    renderDashboard()

    const hero = screen.getByRole('region', { name: /repository status/i })
    const heroLink = await within(hero).findByRole('link', { name: /titvo\/rag-indexer/i })
    expect(heroLink).toHaveAttribute('href', '/scans/s1')
  })

  it('shows the existing "no repos connected" empty-state language inside the hero panel when there are zero repos', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([])
    vi.mocked(listApiKeys).mockResolvedValueOnce([])
    vi.mocked(listUsers).mockResolvedValueOnce([])

    renderDashboard()

    await waitFor(() => expect(screen.getByText(/no repositories connected/i)).toBeInTheDocument())
  })

  it('shows a never-scanned tile for a repo with no scans, not blank or an error (spec: Repo never scanned)', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'titvo/never-scanned', lastScan: null }
    ])
    vi.mocked(listScansForRepo).mockResolvedValueOnce([])
    vi.mocked(listApiKeys).mockResolvedValueOnce([])
    vi.mocked(listUsers).mockResolvedValueOnce([])

    renderDashboard()

    const hero = screen.getByRole('region', { name: /repository status/i })
    await within(hero).findByText('titvo/never-scanned')
    expect(within(hero).getByText(/never scanned/i)).toBeInTheDocument()
  })

  it('computes the scans overview totals and success rate from real scan data across repos', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'repo-a', lastScan: { scanId: 's3', status: 'SUCCESS', createdAt: '2026-01-03T00:00:00Z' } },
      { repositoryId: 'r2', name: 'repo-b', lastScan: null }
    ])
    vi.mocked(listScansForRepo).mockImplementation(async (id: string) => {
      if (id === 'r1') {
        return [
          { scanId: 's1', status: 'SUCCESS', createdAt: '2026-01-01T00:00:00Z' },
          { scanId: 's2', status: 'FAILED', createdAt: '2026-01-02T00:00:00Z' },
          { scanId: 's3', status: 'SUCCESS', createdAt: '2026-01-03T00:00:00Z' }
        ]
      }
      return []
    })
    vi.mocked(listApiKeys).mockResolvedValueOnce([])
    vi.mocked(listUsers).mockResolvedValueOnce([])

    renderDashboard()

    // 'Scans overview' appears in both the section card row and the detail card.
    const overviewCards = await screen.findAllByText('Scans overview')
    const detailCard = overviewCards[overviewCards.length - 1].closest('.dashboard-card') as HTMLElement
    expect(within(detailCard).getByText('3')).toBeInTheDocument()
    expect(within(detailCard).getByText(/67% success rate/i)).toBeInTheDocument()
  })

  it('picks the single most recently created scan across every repo for the Latest scan card', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'repo-a', lastScan: { scanId: 's1', status: 'SUCCESS', createdAt: '2026-01-01T00:00:00Z' } },
      { repositoryId: 'r2', name: 'repo-b', lastScan: { scanId: 's2', status: 'FAILED', createdAt: '2026-01-05T00:00:00Z' } }
    ])
    vi.mocked(listScansForRepo).mockImplementation(async (id: string) => {
      if (id === 'r1') return [{ scanId: 's1', status: 'SUCCESS', createdAt: '2026-01-01T00:00:00Z' }]
      if (id === 'r2') return [{ scanId: 's2', status: 'FAILED', createdAt: '2026-01-05T00:00:00Z' }]
      return []
    })
    vi.mocked(listApiKeys).mockResolvedValueOnce([])
    vi.mocked(listUsers).mockResolvedValueOnce([])

    renderDashboard()

    const latestHeading = await screen.findByText('Latest scan')
    const card = latestHeading.closest('.dashboard-card') as HTMLElement
    expect(within(card).getByText('repo-b')).toBeInTheDocument()
    const viewLink = within(card).getByRole('link', { name: /view/i })
    expect(viewLink).toHaveAttribute('href', '/scans/s2')
  })

  it('shows a calm empty state on the Latest scan card when there are no scans anywhere', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'repo-a', lastScan: null }
    ])
    vi.mocked(listScansForRepo).mockResolvedValueOnce([])
    vi.mocked(listApiKeys).mockResolvedValueOnce([])
    vi.mocked(listUsers).mockResolvedValueOnce([])

    renderDashboard()

    const latestHeading = await screen.findByText('Latest scan')
    const card = latestHeading.closest('.dashboard-card') as HTMLElement
    expect(within(card).getByText(/no scans recorded yet/i)).toBeInTheDocument()
  })

  it('renders real API key and user counts on the section cards, not fabricated data', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([])
    vi.mocked(listApiKeys).mockResolvedValueOnce([
      { keyId: '1', label: 'a', status: 'active' },
      { keyId: '2', label: 'b', status: 'revoked' }
    ])
    vi.mocked(listUsers).mockResolvedValueOnce([
      { userId: '1', email: 'a@b.com', role: 'admin', status: 'active' },
      { userId: '2', email: 'c@d.com', role: 'member', status: 'active' }
    ])

    renderDashboard()

    const apiKeysHeading = await screen.findByText('API keys')
    const apiKeysCard = apiKeysHeading.closest('.dashboard-card') as HTMLElement
    expect(within(apiKeysCard).getByText('2')).toBeInTheDocument()
    expect(within(apiKeysCard).getByText(/active 1/i)).toBeInTheDocument()

    const usersHeadings = await screen.findAllByText('Users')
    const usersCard = usersHeadings[usersHeadings.length - 1].closest('.dashboard-card') as HTMLElement
    expect(within(usersCard).getByText('2')).toBeInTheDocument()
    expect(within(usersCard).getByText(/admins 1/i)).toBeInTheDocument()
  })

  it('surfaces a clear error message when dashboard data fails to load, instead of a blank screen', async () => {
    vi.mocked(listRepos).mockRejectedValueOnce(new Error('boom'))
    vi.mocked(listApiKeys).mockResolvedValueOnce([])
    vi.mocked(listUsers).mockResolvedValueOnce([])

    renderDashboard()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('renders skeleton placeholders while the parallel fetches are in flight, not a blank screen or a spinner', async () => {
    let resolveRepos: (value: never[]) => void = () => {}
    vi.mocked(listRepos).mockReturnValueOnce(new Promise(resolve => { resolveRepos = resolve }))
    vi.mocked(listApiKeys).mockResolvedValueOnce([])
    vi.mocked(listUsers).mockResolvedValueOnce([])

    renderDashboard()

    const loadingRegion = await screen.findByLabelText(/loading dashboard/i)
    expect(loadingRegion.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText('Scans overview')).not.toBeInTheDocument()

    resolveRepos([])
    await waitFor(() => expect(screen.queryByLabelText(/loading dashboard/i)).not.toBeInTheDocument())
    expect(await screen.findAllByText('Scans overview')).toHaveLength(2)
  })
})

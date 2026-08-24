import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../src/api/client')>('../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})
vi.mock('../src/api/config')
vi.mock('../src/api/repos')
vi.mock('../src/api/scans')
vi.mock('../src/api/apiKeys')
vi.mock('../src/api/users')

import { apiFetch } from '../src/api/client'
import { listConfig } from '../src/api/config'
import { listRepos } from '../src/api/repos'
import { getScan } from '../src/api/scans'
import { listApiKeys } from '../src/api/apiKeys'
import { listUsers } from '../src/api/users'
import { App } from '../src/App'

/**
 * `DashboardPage` now fetches repos/api-keys/users on every "/" render (the
 * hero mosaic + stat-card grid — see `src/pages/DashboardPage.tsx`). Any
 * test that renders the app at "/" before navigating away must satisfy
 * that fetch first, in addition to whatever the destination page itself
 * needs.
 */
function mockDashboardLoad (): void {
  vi.mocked(listRepos).mockResolvedValueOnce([])
  vi.mocked(listApiKeys).mockResolvedValueOnce([])
  vi.mocked(listUsers).mockResolvedValueOnce([])
}

describe('App routing', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(listConfig).mockReset()
    vi.mocked(listRepos).mockReset()
    vi.mocked(getScan).mockReset()
    vi.mocked(listApiKeys).mockReset()
    vi.mocked(listUsers).mockReset()
    window.history.pushState({}, '', '/')
  })

  it('navigates from the dashboard to the config list screen (Config nav link)', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'admin' })
    mockDashboardLoad()
    vi.mocked(listConfig).mockResolvedValueOnce([])

    render(<App />)

    const link = await screen.findByRole('link', { name: 'Config' })
    await userEvent.click(link)

    await waitFor(() => expect(screen.getByText(/no configuration entries/i)).toBeInTheDocument())
  })

  it('renders the config add form for an authenticated admin navigating to /config/new', async () => {
    window.history.pushState({}, '', '/config/new')
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'admin' })

    render(<App />)

    expect(await screen.findByRole('heading', { name: /add configuration entry/i })).toBeInTheDocument()
  })

  it('navigates from the dashboard to the repo list screen (Repos nav link)', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'member' })
    mockDashboardLoad()
    vi.mocked(listRepos).mockResolvedValueOnce([])

    render(<App />)

    const link = await screen.findByRole('link', { name: 'Repos' })
    await userEvent.click(link)

    await waitFor(() => expect(screen.getByText(/no repositories connected/i)).toBeInTheDocument())
  })

  it('renders the scan detail screen for an authenticated member navigating to /scans/:id', async () => {
    window.history.pushState({}, '', '/scans/s1')
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'member' })
    vi.mocked(getScan).mockResolvedValueOnce({ scanId: 's1', repositoryId: 'r1', status: 'SUCCESS' })

    render(<App />)

    expect(await screen.findByRole('heading', { name: /scan detail/i })).toBeInTheDocument()
  })

  it('navigates from the dashboard to the API key list screen (API Keys nav link)', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'member' })
    mockDashboardLoad()
    vi.mocked(listApiKeys).mockResolvedValueOnce([])

    render(<App />)

    const link = await screen.findByRole('link', { name: 'API Keys' })
    await userEvent.click(link)

    await waitFor(() => expect(screen.getByText(/no api keys/i)).toBeInTheDocument())
  })

  it('renders the create-key form for an authenticated admin navigating to /api-keys/new', async () => {
    window.history.pushState({}, '', '/api-keys/new')
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'admin' })

    render(<App />)

    expect(await screen.findByRole('heading', { name: /create api key/i })).toBeInTheDocument()
  })

  it('navigates from the dashboard to the user list screen (Users nav link)', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'member' })
    mockDashboardLoad()
    vi.mocked(listUsers).mockResolvedValueOnce([])

    render(<App />)

    const link = await screen.findByRole('link', { name: 'Users' })
    await userEvent.click(link)

    await waitFor(() => expect(screen.getByText(/no users/i)).toBeInTheDocument())
  })

  it('renders the create-user form for an authenticated admin navigating to /users/new', async () => {
    window.history.pushState({}, '', '/users/new')
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'admin' })

    render(<App />)

    expect(await screen.findByRole('heading', { name: /create user/i })).toBeInTheDocument()
  })
})

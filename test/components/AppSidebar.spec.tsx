import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../src/auth/AuthContext'
import { ThemeProvider } from '../../src/components/ThemeProvider'
import { LanguageProvider } from '../../src/components/LanguageProvider'
import { SidebarProvider } from '../../src/components/ui/sidebar'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})

import { apiFetch } from '../../src/api/client'
import { AppSidebar } from '../../src/components/AppSidebar'

function renderSidebar (initialPath = '/'): void {
  vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'jane.doe@titvo.dev', role: 'member' })
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <ThemeProvider>
          <LanguageProvider>
            <SidebarProvider>
              <Routes>
                <Route path='*' element={<><AppSidebar /><div>page body</div></>} />
              </Routes>
            </SidebarProvider>
          </LanguageProvider>
        </ThemeProvider>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    window.localStorage.clear()
  })

  it('renders persistent nav links to Dashboard, Config, Repos, API Keys, and Users for an authenticated session', async () => {
    renderSidebar()

    expect(await screen.findByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Config' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Repos' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'API Keys' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument()
  })

  it('groups navigation into Platform and Administration sections', async () => {
    renderSidebar()

    expect(await screen.findByText('Platform')).toBeInTheDocument()
    expect(screen.getByText('Administration')).toBeInTheDocument()
  })

  it('navigates to the dashboard via the Dashboard nav link', async () => {
    renderSidebar()

    const link = await screen.findByRole('link', { name: 'Dashboard' })
    expect(link).toHaveAttribute('href', '/')
  })

  it('navigates to the repo list screen via the Repos nav link', async () => {
    renderSidebar()

    const link = await screen.findByRole('link', { name: 'Repos' })
    expect(link).toHaveAttribute('href', '/repos')
  })

  it('navigates to the API key list screen via the API Keys nav link', async () => {
    renderSidebar()

    const link = await screen.findByRole('link', { name: 'API Keys' })
    expect(link).toHaveAttribute('href', '/api-keys')
  })

  it('navigates to the user list screen via the Users nav link', async () => {
    renderSidebar()

    const link = await screen.findByRole('link', { name: 'Users' })
    expect(link).toHaveAttribute('href', '/users')
  })

  it('marks only the current route as active in the nav (spec: active-route highlighting)', async () => {
    renderSidebar('/repos')

    const reposLink = await screen.findByRole('link', { name: 'Repos' })
    const configLink = screen.getByRole('link', { name: 'Config' })
    expect(reposLink).toHaveAttribute('aria-current', 'page')
    expect(configLink).not.toHaveAttribute('aria-current')
  })

  it('marks Dashboard active only at the root path, not on every other route', async () => {
    renderSidebar('/repos')

    const dashboardLink = await screen.findByRole('link', { name: 'Dashboard' })
    expect(dashboardLink).not.toHaveAttribute('aria-current')
  })

  it('shows an initials-based avatar for the signed-in user (no profile-picture concept in this app)', async () => {
    renderSidebar()

    expect(await screen.findByLabelText(/signed in as jane\.doe@titvo\.dev/i)).toHaveTextContent('JD')
  })

  it('keeps the existing logout affordance, reachable from the user menu', async () => {
    renderSidebar()

    const trigger = await screen.findByText('jane.doe@titvo.dev')
    await userEvent.click(trigger)

    expect(await screen.findByRole('menuitem', { name: /log out/i })).toBeInTheDocument()
  })

  it('shows the signed-in user role in the footer user menu', async () => {
    renderSidebar()

    expect(await screen.findByText(/member/i)).toBeInTheDocument()
  })
})

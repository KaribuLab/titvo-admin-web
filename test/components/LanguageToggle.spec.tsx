import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../src/auth/AuthContext'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})
vi.mock('../../src/api/repos')
vi.mock('../../src/api/scans')

import { apiFetch } from '../../src/api/client'
import { listRepos } from '../../src/api/repos'
import { RepoListPage } from '../../src/pages/RepoListPage'

function renderPage (): void {
  vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'member' })
  vi.mocked(listRepos).mockResolvedValueOnce([])
  render(
    <MemoryRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RepoListPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

/**
 * End-to-end proof that the EN/ES toggle actually re-renders visible copy
 * (not just that the persistence functions in `lib/language.ts` work in
 * isolation) — exercises `LanguageProvider` + `LanguageToggle` +
 * `useTranslation()` together through a real page rendered via `AppShell`.
 */
describe('LanguageToggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to English', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Repositories' })).toBeInTheDocument()
  })

  it('switches every translated string on the page to Spanish when toggled, and persists the choice', async () => {
    renderPage()

    await screen.findByRole('heading', { name: 'Repositories' })

    const toggle = screen.getByRole('button', { name: /switch to spanish/i })
    await userEvent.click(toggle)

    expect(await screen.findByRole('heading', { name: 'Repositorios' })).toBeInTheDocument()
    expect(screen.getByText('Repositorios conectados y su último escaneo')).toBeInTheDocument()
    expect(window.localStorage.getItem('titvo-language')).toBe('es')
  })

  it('switches back to English when toggled again (the toggle\'s own label is announced in whatever language is CURRENTLY active, so once in Spanish it reads "Cambiar a inglés")', async () => {
    renderPage()
    await screen.findByRole('heading', { name: 'Repositories' })

    await userEvent.click(screen.getByRole('button', { name: /switch to spanish/i }))
    await screen.findByRole('heading', { name: 'Repositorios' })

    await userEvent.click(screen.getByRole('button', { name: /cambiar a inglés/i }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Repositories' })).toBeInTheDocument())
  })
})

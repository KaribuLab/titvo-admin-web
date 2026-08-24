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
vi.mock('../../src/api/repos')
vi.mock('../../src/api/scans')
vi.mock('sonner', async () => {
  const actual = await vi.importActual<typeof import('sonner')>('sonner')
  return { ...actual, toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }
})

import { apiFetch } from '../../src/api/client'
import { listRepos } from '../../src/api/repos'
import { listScansForRepo, triggerScan, getDefaultBranch } from '../../src/api/scans'
import { toast } from 'sonner'
import { RepoListPage } from '../../src/pages/RepoListPage'

function renderAsRole (role: 'admin' | 'member'): void {
  vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role })
  render(
    <MemoryRouter initialEntries={['/repos']}>
      <AuthProvider>
        <Routes>
          <Route path="/repos" element={<RepoListPage />} />
          <Route path="/scans/:scanId" element={<div>Scan Detail Page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )
}

describe('RepoListPage', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
    vi.mocked(listRepos).mockReset()
    vi.mocked(listScansForRepo).mockReset()
    vi.mocked(triggerScan).mockReset()
    vi.mocked(toast.success).mockReset()
    vi.mocked(toast.warning).mockReset()
    // Auto-detect-default-branch is a best-effort nicety fired on every
    // dialog open — default it to a slow-resolving/no-op-ish success so
    // tests that don't care about it aren't forced to mock it individually.
    vi.mocked(getDefaultBranch).mockReset()
    vi.mocked(getDefaultBranch).mockResolvedValue('main')
  })

  it('renders an explicit empty state (not an error) when no repos are connected (spec: No repos connected)', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([])

    renderAsRole('member')

    await waitFor(() => expect(screen.getByText(/no repositories connected/i)).toBeInTheDocument())
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows a "never scanned" state for a repo with no scans, not blank or an error (spec: Repo never scanned)', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
    ])

    renderAsRole('member')

    await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
    expect(screen.getByText(/never scanned/i)).toBeInTheDocument()
  })

  it('renders IN_PROGRESS, FAILED and TIMEOUT scans as distinct states, never as "unknown" (spec: Scan Status Fidelity)', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'repo-alpha', lastScan: { scanId: 's1', status: 'IN_PROGRESS' } },
      { repositoryId: 'r2', name: 'repo-beta', lastScan: { scanId: 's2', status: 'FAILED' } },
      { repositoryId: 'r3', name: 'repo-gamma', lastScan: { scanId: 's3', status: 'TIMEOUT' } }
    ])

    renderAsRole('member')

    await waitFor(() => expect(screen.getByText('repo-alpha')).toBeInTheDocument())
    expect(screen.getByText(/in progress/i)).toBeInTheDocument()
    expect(screen.getByText(/failed/i)).toBeInTheDocument()
    expect(screen.getByText(/timeout/i)).toBeInTheDocument()
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument()
  })

  it('lists every connected repo with its last-scan status when repos exist (spec: Repos exist)', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: { scanId: 's1', status: 'SUCCESS', createdAt: '2026-01-01T00:00:00Z' } }
    ])

    renderAsRole('member')

    await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
    expect(screen.getByText(/success/i)).toBeInTheDocument()
  })

  it('links the last-scan status directly to its scan detail view', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'titvo/rag-indexer', lastScan: { scanId: 's1', status: 'SUCCESS' } }
    ])

    renderAsRole('member')

    const link = await screen.findByRole('link', { name: /success/i })
    expect(link).toHaveAttribute('href', '/scans/s1')
  })

  it('loads and shows scan history for a repo on demand, using GET /api/admin/repos/:id/scans', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'titvo/rag-indexer', lastScan: { scanId: 's2', status: 'SUCCESS' } }
    ])
    vi.mocked(listScansForRepo).mockResolvedValueOnce([
      { scanId: 's2', status: 'SUCCESS', createdAt: '2026-01-02T00:00:00Z' },
      { scanId: 's1', status: 'FAILED', createdAt: '2026-01-01T00:00:00Z' }
    ])

    renderAsRole('member')

    await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
    await userEvent.click(screen.getByRole('button', { name: /history/i }))

    await waitFor(() => expect(listScansForRepo).toHaveBeenCalledWith('r1'))
    const historyLinks = await screen.findAllByRole('link', { name: /success|failed/i })
    expect(historyLinks.length).toBeGreaterThanOrEqual(2)
  })

  it('surfaces a clear error message when listing fails, instead of a blank screen', async () => {
    vi.mocked(listRepos).mockRejectedValueOnce(new ApiError(500, undefined))

    renderAsRole('member')

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('renders the same read-accessible view for a member session, with no rescan/trigger control (spec: Empty and Read-Only Boundaries)', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'titvo/rag-indexer', lastScan: null }
    ])

    renderAsRole('member')

    await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /rescan|trigger|scan now/i })).not.toBeInTheDocument()
  })

  it('filters the repo list by name via client-side search, with no new BFF call (new behavior)', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'titvo/rag-indexer', lastScan: null },
      { repositoryId: 'r2', name: 'titvo/admin-web', lastScan: null }
    ])

    renderAsRole('member')

    await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
    expect(screen.getByText('titvo/admin-web')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('searchbox', { name: /search repositories/i }), 'admin')

    expect(screen.queryByText('titvo/rag-indexer')).not.toBeInTheDocument()
    expect(screen.getByText('titvo/admin-web')).toBeInTheDocument()
    expect(listRepos).toHaveBeenCalledTimes(1)
  })

  it('shows a "no matches" message (not the connect-a-repo empty state) when a search matches nothing', async () => {
    vi.mocked(listRepos).mockResolvedValueOnce([
      { repositoryId: 'r1', name: 'titvo/rag-indexer', lastScan: null }
    ])

    renderAsRole('member')

    await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
    await userEvent.type(screen.getByRole('searchbox', { name: /search repositories/i }), 'no-such-repo')

    expect(screen.queryByText('titvo/rag-indexer')).not.toBeInTheDocument()
    expect(screen.getByText(/no repositories match/i)).toBeInTheDocument()
    expect(screen.queryByText(/no repositories connected yet/i)).not.toBeInTheDocument()
  })

  describe('Run scan (trigger-a-scan feature)', () => {
    it('shows "Run scan" for an admin on a github repo', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: /run scan/i })).toBeInTheDocument()
    })

    it('does NOT show "Run scan" for a member, even on a github repo', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])

      renderAsRole('member')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: /run scan/i })).not.toBeInTheDocument()
    })

    it('shows "Run scan" for an admin on a bitbucket repo too (Bitbucket parity)', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/legacy', provider: 'bitbucket', lastScan: null }
      ])

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/legacy')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: /run scan/i })).toBeInTheDocument()
    })

    it('does NOT show "Run scan" for an admin on a repo whose provider is neither github nor bitbucket (e.g. gitlab)', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/other', provider: 'gitlab', lastScan: null }
      ])

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/other')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: /run scan/i })).not.toBeInTheDocument()
    })

    it('does NOT show "Run scan" for an admin when the repo has no provider on record', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/unknown', lastScan: null }
      ])

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/unknown')).toBeInTheDocument())
      expect(screen.queryByRole('button', { name: /run scan/i })).not.toBeInTheDocument()
    })

    it('opens a dialog pre-filled with "main" as the branch', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))

      expect(await screen.findByRole('dialog')).toBeInTheDocument()
      expect(screen.getByLabelText(/branch/i)).toHaveValue('main')
    })

    it('replaces the "main" guess with the auto-detected default branch once it resolves', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])
      vi.mocked(getDefaultBranch).mockResolvedValueOnce('develop')

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))
      await screen.findByRole('dialog')

      await waitFor(() => expect(getDefaultBranch).toHaveBeenCalledWith('r1'))
      await waitFor(() => expect(screen.getByLabelText(/branch/i)).toHaveValue('develop'))
    })

    it('silently falls back to "main" (no error shown) when auto-detecting the default branch fails', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])
      vi.mocked(getDefaultBranch).mockRejectedValueOnce(new ApiError(422, 'config_missing'))

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))
      await screen.findByRole('dialog')

      await waitFor(() => expect(getDefaultBranch).toHaveBeenCalledWith('r1'))
      expect(screen.getByLabelText(/branch/i)).toHaveValue('main')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('does not overwrite a branch the admin already started editing once auto-detect resolves late', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])
      let resolveDetected: (branch: string) => void = () => {}
      vi.mocked(getDefaultBranch).mockReturnValueOnce(new Promise(resolve => { resolveDetected = resolve }))

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))
      await screen.findByRole('dialog')

      const branchInput = screen.getByLabelText(/branch/i)
      await userEvent.clear(branchInput)
      await userEvent.type(branchInput, 'my-feature-branch')

      resolveDetected('develop')
      await waitFor(() => expect(getDefaultBranch).toHaveBeenCalled())

      expect(screen.getByLabelText(/branch/i)).toHaveValue('my-feature-branch')
    })

    it('leaves scan_mode unset by default (full-scan checkbox starts unchecked)', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))
      await screen.findByRole('dialog')

      expect(screen.getByRole('checkbox', { name: /full scan/i })).not.toBeChecked()
    })

    it('passes scan_mode:"full" when the full-scan checkbox is checked', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])
      vi.mocked(triggerScan).mockResolvedValueOnce({ scanId: 'scan-full-1' })

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))
      await screen.findByRole('dialog')

      await userEvent.click(screen.getByRole('checkbox', { name: /full scan/i }))
      await userEvent.click(screen.getByRole('button', { name: /^run scan$/i }))

      await waitFor(() => expect(triggerScan).toHaveBeenCalledWith('r1', 'main', 'full'))
    })

    it('submits the edited branch, then on success toasts and navigates to the new scan detail page', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])
      vi.mocked(triggerScan).mockResolvedValueOnce({ scanId: 'scan-999' })

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))
      await screen.findByRole('dialog')

      const branchInput = screen.getByLabelText(/branch/i)
      await userEvent.clear(branchInput)
      await userEvent.type(branchInput, 'develop')
      await userEvent.click(screen.getByRole('button', { name: /^run scan$/i, hidden: false }))

      await waitFor(() => expect(triggerScan).toHaveBeenCalledWith('r1', 'develop', undefined))
      await waitFor(() => expect(screen.getByText('Scan Detail Page')).toBeInTheDocument())
      expect(toast.success).toHaveBeenCalled()
    })

    it('does not show a warning toast when the BFF response has none', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])
      vi.mocked(triggerScan).mockResolvedValueOnce({ scanId: 'scan-999' })

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))
      await screen.findByRole('dialog')
      await userEvent.click(screen.getByRole('button', { name: /^run scan$/i }))

      await waitFor(() => expect(screen.getByText('Scan Detail Page')).toBeInTheDocument())
      expect(toast.warning).not.toHaveBeenCalled()
    })

    it('shows a non-blocking warning toast (in addition to the success toast) when the BFF flags a repositoryId mismatch', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])
      vi.mocked(triggerScan).mockResolvedValueOnce({
        scanId: 'scan-999',
        warning: "This scan won't be linked to this repository's existing history..."
      })

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))
      await screen.findByRole('dialog')
      await userEvent.click(screen.getByRole('button', { name: /^run scan$/i }))

      // Still navigates and still shows the success toast — the warning is additive, never blocking.
      await waitFor(() => expect(screen.getByText('Scan Detail Page')).toBeInTheDocument())
      expect(toast.success).toHaveBeenCalled()
      expect(toast.warning).toHaveBeenCalledWith("This scan won't be linked to this repository's existing history...")
    })

    it('submits successfully for a bitbucket repo too, via the exact same dialog flow', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r2', name: 'titvo/legacy', provider: 'bitbucket', lastScan: null }
      ])
      vi.mocked(triggerScan).mockResolvedValueOnce({ scanId: 'scan-bb-1' })

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/legacy')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))
      await screen.findByRole('dialog')
      await userEvent.click(screen.getByRole('button', { name: /^run scan$/i }))

      await waitFor(() => expect(triggerScan).toHaveBeenCalledWith('r2', 'main', undefined))
      await waitFor(() => expect(screen.getByText('Scan Detail Page')).toBeInTheDocument())
    })

    it('surfaces the BFF\'s exact config_missing message via an Alert, without navigating away', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])
      vi.mocked(triggerScan).mockRejectedValueOnce(new ApiError(422, 'config_missing', "Missing required config parameter 'default_github_assignee'. Set it via Config before triggering a scan."))

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))
      await screen.findByRole('dialog')
      await userEvent.click(screen.getByRole('button', { name: /^run scan$/i }))

      expect(await screen.findByText(/default_github_assignee/)).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.queryByText('Scan Detail Page')).not.toBeInTheDocument()
    })

    it('shows a clear message (not a raw error) when the trigger call fails generically', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])
      vi.mocked(triggerScan).mockRejectedValueOnce(new ApiError(502, 'upstream_error'))

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))
      await screen.findByRole('dialog')
      await userEvent.click(screen.getByRole('button', { name: /^run scan$/i }))

      expect(await screen.findByText(/unavailable/i)).toBeInTheDocument()
    })

    it('cancel closes the dialog without calling triggerScan', async () => {
      vi.mocked(listRepos).mockResolvedValueOnce([
        { repositoryId: 'r1', name: 'titvo/rag-indexer', provider: 'github', lastScan: null }
      ])

      renderAsRole('admin')

      await waitFor(() => expect(screen.getByText('titvo/rag-indexer')).toBeInTheDocument())
      await userEvent.click(screen.getByRole('button', { name: /run scan/i }))
      await screen.findByRole('dialog')

      await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(triggerScan).not.toHaveBeenCalled()
    })
  })
})

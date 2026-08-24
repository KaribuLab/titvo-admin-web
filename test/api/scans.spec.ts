import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '../../src/api/client'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})

import { apiFetch } from '../../src/api/client'
import { listScansForRepo, getScan, triggerScan, getDefaultBranch } from '../../src/api/scans'

describe('scans API', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  describe('listScansForRepo', () => {
    it('requests the encoded repository id path and maps the wire shape, newest first as returned', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        items: [
          { scan_id: 's2', status: 'SUCCESS', source: 'github', branch: 'main', created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:05:00Z' },
          { scan_id: 's1', status: 'FAILED', created_at: '2026-01-01T00:00:00Z' }
        ]
      })

      const items = await listScansForRepo('repo/with slash')

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/repos/repo%2Fwith%20slash/scans')
      expect(items).toEqual([
        { scanId: 's2', status: 'SUCCESS', source: 'github', branch: 'main', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:05:00Z' },
        { scanId: 's1', status: 'FAILED', source: undefined, branch: undefined, createdAt: '2026-01-01T00:00:00Z', updatedAt: undefined }
      ])
    })

    it('renders an empty list (not an error) for an unknown or orphan repository id (spec: Orphan Data Resilience)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ items: [] })

      const items = await listScansForRepo('orphan-id')

      expect(items).toEqual([])
    })
  })

  describe('getScan', () => {
    it('requests the encoded scan id and maps the full detail wire shape', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        scan_id: 's1',
        repository_id: 'r1',
        status: 'SUCCESS',
        source: 'github',
        branch: 'main',
        args: { depth: 1 },
        result: { findings: 0 },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:05:00Z'
      })

      const detail = await getScan('s1')

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/scans/s1')
      expect(detail).toEqual({
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
    })

    it('propagates a 404 not_found ApiError so the caller can surface "this scan no longer exists"', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(404, 'not_found'))

      await expect(getScan('gone')).rejects.toMatchObject({ status: 404, code: 'not_found' })
    })
  })

  describe('triggerScan', () => {
    it('POSTs the branch to the encoded repository trigger-scan path and maps scan_id', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ scan_id: 'scan-123' })

      const result = await triggerScan('repo/with slash', 'main')

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/repos/repo%2Fwith%20slash/trigger-scan', {
        method: 'POST',
        body: { branch: 'main' }
      })
      expect(result).toEqual({ scanId: 'scan-123' })
    })

    it('propagates a 422 config_missing ApiError carrying the BFF\'s actionable message', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(422, 'config_missing', "Missing required config parameter 'default_github_assignee'."))

      await expect(triggerScan('repo-1', 'main')).rejects.toMatchObject({
        status: 422,
        code: 'config_missing',
        message: "Missing required config parameter 'default_github_assignee'."
      })
    })

    it('propagates a 403 forbidden ApiError for a member session', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(403, 'forbidden'))

      await expect(triggerScan('repo-1', 'main')).rejects.toMatchObject({ status: 403, code: 'forbidden' })
    })

    it('omits scan_mode from the body when not passed (defaults to commit server-side)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ scan_id: 'scan-123' })

      await triggerScan('repo-1', 'main')

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/repos/repo-1/trigger-scan', {
        method: 'POST',
        body: { branch: 'main' }
      })
    })

    it('includes scan_mode:"full" in the body when requested (full scan toggle)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ scan_id: 'scan-123' })

      await triggerScan('repo-1', 'main', 'full')

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/repos/repo-1/trigger-scan', {
        method: 'POST',
        body: { branch: 'main', scan_mode: 'full' }
      })
    })

    it('passes the BFF\'s "warning" field through (repositoryId mismatch signal)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ scan_id: 'scan-123', warning: 'mismatch warning text' })

      const result = await triggerScan('repo-1', 'main')

      expect(result).toEqual({ scanId: 'scan-123', warning: 'mismatch warning text' })
    })

    it('leaves warning undefined when the BFF response has none', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ scan_id: 'scan-123' })

      const result = await triggerScan('repo-1', 'main')

      expect(result.warning).toBeUndefined()
    })
  })

  describe('getDefaultBranch', () => {
    it('requests the encoded repository default-branch path and returns the branch name', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ branch: 'develop' })

      const branch = await getDefaultBranch('repo/with slash')

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/repos/repo%2Fwith%20slash/default-branch')
      expect(branch).toBe('develop')
    })

    it('propagates errors (caller falls back to "main" on failure)', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(422, 'config_missing'))

      await expect(getDefaultBranch('repo-1')).rejects.toMatchObject({ status: 422, code: 'config_missing' })
    })
  })
})

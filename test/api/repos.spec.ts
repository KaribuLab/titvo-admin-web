import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})

import { apiFetch } from '../../src/api/client'
import { listRepos } from '../../src/api/repos'

describe('repos API', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  describe('listRepos', () => {
    it('maps the wire shape to camelCase, including the embedded last_scan', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        items: [
          {
            repository_id: 'r1',
            name: 'titvo/rag-indexer',
            url: 'https://github.com/titvo/rag-indexer',
            provider: 'github',
            last_scan: { scan_id: 's1', status: 'SUCCESS', created_at: '2026-01-01T00:00:00Z' }
          }
        ]
      })

      const items = await listRepos()

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/repos')
      expect(items).toEqual([
        {
          repositoryId: 'r1',
          name: 'titvo/rag-indexer',
          url: 'https://github.com/titvo/rag-indexer',
          provider: 'github',
          lastScan: { scanId: 's1', status: 'SUCCESS', source: undefined, branch: undefined, createdAt: '2026-01-01T00:00:00Z', updatedAt: undefined }
        }
      ])
    })

    it('maps a repo that has never been scanned to lastScan: null, not an error (spec: Repo never scanned)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        items: [{ repository_id: 'r2', name: 'titvo/never-scanned', last_scan: null }]
      })

      const items = await listRepos()

      expect(items[0].lastScan).toBeNull()
    })

    it('tolerates a repository row missing optional fields (design risk resolution #3 — unverified upstream writer shape)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        items: [{ repository_id: 'r3', last_scan: null }]
      })

      const items = await listRepos()

      expect(items[0]).toEqual({ repositoryId: 'r3', name: undefined, url: undefined, provider: undefined, lastScan: null })
    })

    it('renders an empty list (not an error) when no repos are connected (spec: No repos connected)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ items: [] })

      const items = await listRepos()

      expect(items).toEqual([])
    })
  })
})

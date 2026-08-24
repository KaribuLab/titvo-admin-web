import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})

import { apiFetch } from '../../src/api/client'
import { createApiKey, listApiKeys, revokeApiKey } from '../../src/api/apiKeys'

describe('apiKeys API', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  describe('listApiKeys', () => {
    it('maps the wire shape to camelCase (spec: Metadata-Only Listing)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        items: [
          {
            key_id: 'k1',
            label: 'CI pipeline',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            created_by: 'admin@titvo.io',
            last_used_at: '2026-01-05T00:00:00Z'
          }
        ]
      })

      const items = await listApiKeys()

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/api-keys')
      expect(items).toEqual([
        {
          keyId: 'k1',
          label: 'CI pipeline',
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          createdBy: 'admin@titvo.io',
          lastUsedAt: '2026-01-05T00:00:00Z',
          revokedAt: undefined
        }
      ])
    })

    it('never carries an api_key field anywhere in its mapped output, even if the server accidentally sent one', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        items: [{ key_id: 'k1', label: 'CI pipeline', status: 'active', api_key: 'tvok-leaked' }]
      })

      const items = await listApiKeys()

      expect(JSON.stringify(items)).not.toContain('tvok-leaked')
      expect((items[0] as unknown as Record<string, unknown>).apiKey).toBeUndefined()
    })

    it('renders an empty list, not an error, when no keys exist', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ items: [] })

      const items = await listApiKeys()

      expect(items).toEqual([])
    })
  })

  describe('createApiKey', () => {
    it('posts the label and maps the raw key response (spec: Create Key With Show-Once Raw Value)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ key_id: 'k2', label: 'New key', api_key: 'tvok-abc123' })

      const created = await createApiKey('New key')

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/api-keys', { method: 'POST', body: { label: 'New key' } })
      expect(created).toEqual({ keyId: 'k2', label: 'New key', apiKey: 'tvok-abc123' })
    })
  })

  describe('revokeApiKey', () => {
    it('posts to the :id/revoke endpoint and maps the response', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ key_id: 'k1', status: 'revoked' })

      const revoked = await revokeApiKey('k1')

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/api-keys/k1/revoke', { method: 'POST' })
      expect(revoked).toEqual({ keyId: 'k1', status: 'revoked' })
    })

    it('URL-encodes the key id', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ key_id: 'k/1', status: 'revoked' })

      await revokeApiKey('k/1')

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/api-keys/k%2F1/revoke', { method: 'POST' })
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiError } from '../../src/api/client'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})

import { apiFetch } from '../../src/api/client'
import { addConfig, getConfig, listConfig, updateConfig } from '../../src/api/config'

describe('config API', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  describe('listConfig', () => {
    it('maps the wire shape to camelCase and never expects a value field (spec: list never exposes secret value)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        items: [
          { parameter_id: 'API_KEY', is_secret: true, updated_at: '2026-01-01T00:00:00Z', updated_by: 'admin@titvo.io' },
          { parameter_id: 'REGION', is_secret: false, updated_at: '2026-01-02T00:00:00Z', updated_by: 'admin@titvo.io' }
        ]
      })

      const items = await listConfig()

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/config')
      expect(items).toEqual([
        { parameterId: 'API_KEY', isSecret: true, updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'admin@titvo.io' },
        { parameterId: 'REGION', isSecret: false, updatedAt: '2026-01-02T00:00:00Z', updatedBy: 'admin@titvo.io' }
      ])
    })

    it('renders an empty list (not an error) when the table has no entries (spec: Empty table)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ items: [] })

      const items = await listConfig()

      expect(items).toEqual([])
    })
  })

  describe('getConfig', () => {
    it('requests the encoded parameter id and maps the wire shape', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        parameter_id: 'REGION', is_secret: false, value: 'us-east-1', updated_at: '2026-01-02T00:00:00Z', updated_by: 'admin@titvo.io'
      })

      const item = await getConfig('REGION')

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/config/REGION')
      expect(item).toEqual({
        parameterId: 'REGION', isSecret: false, value: 'us-east-1', updatedAt: '2026-01-02T00:00:00Z', updatedBy: 'admin@titvo.io'
      })
    })

    it('never surfaces a `value` for a secret (spec: Secret Values Are Write-Only)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        parameter_id: 'API_KEY', is_secret: true, updated_at: '2026-01-01T00:00:00Z', updated_by: 'admin@titvo.io'
      })

      const item = await getConfig('API_KEY')

      expect(item.value).toBeUndefined()
    })
  })

  describe('addConfig', () => {
    it('POSTs the wire shape and resolves on success', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ parameter_id: 'NEW_KEY' })

      await addConfig({ parameterId: 'NEW_KEY', value: 'secret-value', isSecret: true })

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/config', {
        method: 'POST',
        body: { parameter_id: 'NEW_KEY', value: 'secret-value', is_secret: true }
      })
    })

    it('propagates a 409 already_exists ApiError so the caller can surface "this key already exists" (spec: Add with existing key)', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(409, 'already_exists'))

      await expect(addConfig({ parameterId: 'API_KEY', value: 'x', isSecret: true })).rejects.toMatchObject({
        status: 409,
        code: 'already_exists'
      })
    })
  })

  describe('updateConfig', () => {
    it('PUTs only value to the encoded id path, leaving is_secret untouched by default (last-write-wins, design D4)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ parameter_id: 'REGION' })

      await updateConfig('REGION', { value: 'us-west-2' })

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/config/REGION', {
        method: 'PUT',
        body: { value: 'us-west-2', is_secret: undefined }
      })
    })

    it('propagates a 404 not_found ApiError', async () => {
      vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(404, 'not_found'))

      await expect(updateConfig('GONE', { value: 'x' })).rejects.toMatchObject({ status: 404, code: 'not_found' })
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})

import { apiFetch } from '../../src/api/client'
import { createUser, listUsers, updateUser } from '../../src/api/users'

describe('users API', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  describe('listUsers', () => {
    it('maps the wire shape to camelCase (spec: List Users)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        items: [
          {
            user_id: 'u1',
            email: 'admin@titvo.io',
            role: 'admin',
            status: 'active',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z'
          }
        ]
      })

      const items = await listUsers()

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/users')
      expect(items).toEqual([
        {
          userId: 'u1',
          email: 'admin@titvo.io',
          role: 'admin',
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z'
        }
      ])
    })

    it('renders just the seed admin, not an error, when no other users exist (spec: List beyond seed-admin)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({
        items: [{ user_id: 'seed', email: 'seed@titvo.io', role: 'admin', status: 'active' }]
      })

      const items = await listUsers()

      expect(items).toEqual([{ userId: 'seed', email: 'seed@titvo.io', role: 'admin', status: 'active', createdAt: undefined, updatedAt: undefined }])
    })
  })

  describe('createUser', () => {
    it('posts email/password/role and maps the created-user response (spec: Admin-Set-Password Invite)', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u2', email: 'new@titvo.io', role: 'member' })

      const created = await createUser('new@titvo.io', 'super-secret-1', 'member')

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/users', {
        method: 'POST',
        body: { email: 'new@titvo.io', password: 'super-secret-1', role: 'member' }
      })
      expect(created).toEqual({ userId: 'u2', email: 'new@titvo.io', role: 'member' })
    })
  })

  describe('updateUser', () => {
    it('patches role and maps the response', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u2', email: 'new@titvo.io', role: 'admin', status: 'active' })

      const updated = await updateUser('u2', { role: 'admin' })

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/users/u2', { method: 'PATCH', body: { role: 'admin' } })
      expect(updated).toEqual({ userId: 'u2', email: 'new@titvo.io', role: 'admin', status: 'active' })
    })

    it('patches status and URL-encodes the user id', async () => {
      vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u/2', email: 'new@titvo.io', role: 'member', status: 'inactive' })

      await updateUser('u/2', { status: 'inactive' })

      expect(apiFetch).toHaveBeenCalledWith('/api/admin/users/u%2F2', { method: 'PATCH', body: { status: 'inactive' } })
    })
  })
})

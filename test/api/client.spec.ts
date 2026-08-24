import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, ApiError } from '../../src/api/client'

describe('apiFetch', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('always sends credentials: include so the httpOnly session cookie is attached', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    )

    await apiFetch('/api/admin/health')

    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/health',
      expect.objectContaining({ credentials: 'include' })
    )
  })

  it('parses and returns the JSON body on a 2xx response', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ user_id: 'u1', email: 'a@b.com', role: 'admin' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    const result = await apiFetch<{ user_id: string }>('/api/admin/auth/me')

    expect(result.user_id).toBe('u1')
  })

  it('returns undefined for a 204 No Content response without attempting to parse a body', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(new Response(null, { status: 204 }))

    const result = await apiFetch('/api/admin/auth/logout', { method: 'POST' })

    expect(result).toBeUndefined()
  })

  it('throws a typed ApiError carrying the status and error code on a non-2xx response', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await expect(apiFetch('/api/admin/auth/login', { method: 'POST' })).rejects.toMatchObject({
      status: 401,
      code: 'invalid_credentials'
    })
  })

  it('carries the BFF\'s own message field when present, for screens that need the exact server text (e.g. trigger-scan config_missing)', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ error: 'config_missing', message: "Missing required config parameter 'default_github_assignee'." }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await expect(apiFetch('/api/admin/repos/repo-1/trigger-scan', { method: 'POST' })).rejects.toMatchObject({
      status: 422,
      code: 'config_missing',
      message: "Missing required config parameter 'default_github_assignee'."
    })
  })

  it('ApiError is an instance of Error and exposes status 401 for unauthenticated detection', async () => {
    ;(globalThis.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
    )

    try {
      await apiFetch('/api/admin/config')
      expect.fail('expected apiFetch to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).status).toBe(401)
    }
  })

  it('never persists the response into localStorage or sessionStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    ;(globalThis.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ user_id: 'u1', email: 'a@b.com', role: 'admin' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )

    await apiFetch('/api/admin/auth/me')

    expect(setItemSpy).not.toHaveBeenCalled()
  })
})

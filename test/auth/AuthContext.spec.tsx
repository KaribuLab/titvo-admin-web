import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../../src/auth/AuthContext'
import { ApiError } from '../../src/api/client'

vi.mock('../../src/api/client', async () => {
  const actual = await vi.importActual<typeof import('../../src/api/client')>('../../src/api/client')
  return { ...actual, apiFetch: vi.fn() }
})

import { apiFetch } from '../../src/api/client'

const wrapper = ({ children }: { children: React.ReactNode }): React.ReactElement => (
  <AuthProvider>{children}</AuthProvider>
)

describe('AuthContext', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset()
  })

  it('starts in loading status and resolves to authenticated when GET /api/admin/auth/me succeeds', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'admin' })

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.status).toBe('loading')

    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    expect(result.current.user).toEqual({ userId: 'u1', email: 'a@b.com', role: 'admin' })
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/auth/me')
  })

  it('resolves to unauthenticated when GET /api/admin/auth/me returns 401', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(401, 'unauthorized'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))
    expect(result.current.user).toBeNull()
  })

  it('login() posts credentials and transitions to authenticated on success', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(401, 'unauthorized')) // initial me()
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u2', email: 'member@b.com', role: 'member' })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))

    await act(async () => {
      await result.current.login('member@b.com', 'secret')
    })

    expect(result.current.status).toBe('authenticated')
    expect(result.current.user).toEqual({ userId: 'u2', email: 'member@b.com', role: 'member' })
    expect(apiFetch).toHaveBeenCalledWith('/api/admin/auth/login', {
      method: 'POST',
      body: { email: 'member@b.com', password: 'secret' }
    })
  })

  it('login() rejects with the ApiError and leaves status unauthenticated on invalid credentials', async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(401, 'unauthorized')) // initial me()
    vi.mocked(apiFetch).mockRejectedValueOnce(new ApiError(401, 'invalid_credentials'))

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))

    await expect(
      act(async () => {
        await result.current.login('member@b.com', 'wrong')
      })
    ).rejects.toMatchObject({ code: 'invalid_credentials' })

    expect(result.current.status).toBe('unauthenticated')
    expect(result.current.user).toBeNull()
  })

  it('logout() clears the session state even if the server call fails, and never touches localStorage/sessionStorage', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'admin' }) // initial me()
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error('network down')) // logout call fails

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    await act(async () => {
      await result.current.logout()
    })

    expect(result.current.status).toBe('unauthenticated')
    expect(result.current.user).toBeNull()
    expect(setItemSpy).not.toHaveBeenCalled()
  })

  it('notifySessionExpired() flips an authenticated session to expired without an implicit redirect', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({ user_id: 'u1', email: 'a@b.com', role: 'admin' })

    const { result } = renderHook(() => useAuth(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    act(() => {
      result.current.notifySessionExpired()
    })

    expect(result.current.status).toBe('expired')
    expect(result.current.user).toBeNull()
  })
})

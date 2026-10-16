import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from '../services/api'

describe('ApiClient', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('stores and retrieves token from localStorage', () => {
    expect(api.getToken()).toBeNull()
    api.setToken('test-token-123')
    expect(api.getToken()).toBe('test-token-123')
    expect(localStorage.getItem('resolvex_token')).toBe('test-token-123')

    api.clearToken()
    expect(api.getToken()).toBeNull()
    expect(localStorage.getItem('resolvex_token')).toBeNull()
  })

  it('attaches Authorization header when token exists', async () => {
    api.setToken('my-jwt-token')

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'user-1', email: 'test@example.com' }),
    })
    globalThis.fetch = mockFetch

    const result = await api.auth.getMe()
    expect(result.id).toBe('user-1')
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/auth/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-jwt-token',
        }),
      })
    )
  })

  it('dispatches unauthorized event and clears token on 401', async () => {
    api.setToken('expired-token')
    const listener = vi.fn()
    window.addEventListener('resolvex:unauthorized', listener)

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ detail: 'Token has expired' }),
    })

    await expect(api.auth.getMe()).rejects.toThrow(ApiError)
    expect(listener).toHaveBeenCalled()
    expect(api.getToken()).toBeNull()

    window.removeEventListener('resolvex:unauthorized', listener)
  })

  it('formats FastAPI validation error arrays properly in ApiError', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({
        detail: [
          { msg: 'Field required' },
          { msg: 'String should have at least 3 characters' },
        ],
      }),
    })

    await expect(
      api.organizations.create({
        name: 'ab',
        official_email_domain: 'example.org',
        official_website: 'https://example.org',
        proof_document_reference: 'secure-doc-ref',
        contact_phone: '+1 555 123 4567',
      })
    ).rejects.toThrow('Field required, String should have at least 3 characters')
  })
})

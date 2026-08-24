import { apiFetch } from './client'

/**
 * Typed BFF API-key client (design.md "API contract" — Phase 3, all under
 * `/api/admin/api-keys`). List responses NEVER carry `api_key` — only
 * `createApiKey()`'s response ever does, exactly once (spec: Create Key
 * With Show-Once Raw Value / Raw Key Permanently Unavailable).
 */
export interface ApiKeyListItem {
  keyId: string
  label: string
  status: 'active' | 'revoked'
  createdAt?: string
  createdBy?: string
  lastUsedAt?: string
  revokedAt?: string
}

interface ApiKeyListItemWire {
  key_id: string
  label: string
  status: 'active' | 'revoked'
  created_at?: string
  created_by?: string
  last_used_at?: string
  revoked_at?: string
}

interface ApiKeyListResponse {
  items: ApiKeyListItemWire[]
}

function toApiKeyListItem (wire: ApiKeyListItemWire): ApiKeyListItem {
  return {
    keyId: wire.key_id,
    label: wire.label,
    status: wire.status,
    createdAt: wire.created_at,
    createdBy: wire.created_by,
    lastUsedAt: wire.last_used_at,
    revokedAt: wire.revoked_at
  }
}

/**
 * `GET /api/admin/api-keys` — readable by both `admin` and `member` (spec:
 * Metadata-Only Listing). `toApiKeyListItem` only ever reads the fields
 * declared on `ApiKeyListItemWire`, which has no `api_key` field at all —
 * even if the server accidentally included one, it can never survive this
 * mapping into `ApiKeyListItem`.
 */
export async function listApiKeys (): Promise<ApiKeyListItem[]> {
  const response = await apiFetch<ApiKeyListResponse>('/api/admin/api-keys')
  return response.items.map(toApiKeyListItem)
}

/**
 * The ONLY shape in this entire client that ever carries `apiKey` — the raw
 * `tvok-…` value, returned exactly once by `createApiKey()` and never
 * fetchable again (spec: Raw Key Permanently Unavailable).
 */
export interface CreatedApiKey {
  keyId: string
  label: string
  apiKey: string
}

interface CreatedApiKeyWire {
  key_id: string
  label: string
  api_key: string
}

/** `POST /api/admin/api-keys` — admin-only (BFF 403s a member); 400 `invalid_request` on an empty label. */
export async function createApiKey (label: string): Promise<CreatedApiKey> {
  const response = await apiFetch<CreatedApiKeyWire>('/api/admin/api-keys', {
    method: 'POST',
    body: { label }
  })
  return { keyId: response.key_id, label: response.label, apiKey: response.api_key }
}

export interface RevokedApiKey {
  keyId: string
  status: 'revoked'
}

interface RevokedApiKeyWire {
  key_id: string
  status: 'revoked'
}

/**
 * `POST /api/admin/api-keys/:id/revoke` — admin-only. `409 last_active_key`
 * when this is the platform's last active key (design risk resolution #1,
 * blocking the invariant the same shape as D6's last-admin guard);
 * already-revoked is idempotent `200`.
 */
export async function revokeApiKey (keyId: string): Promise<RevokedApiKey> {
  const response = await apiFetch<RevokedApiKeyWire>(`/api/admin/api-keys/${encodeURIComponent(keyId)}/revoke`, {
    method: 'POST'
  })
  return { keyId: response.key_id, status: response.status }
}

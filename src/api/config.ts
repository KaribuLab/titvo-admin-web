import { apiFetch } from './client'

/**
 * Typed BFF config CRUD client (design.md "API contract" — Phase 1 BFF,
 * all under `/api/admin/config`). List/get responses NEVER carry a
 * plaintext/ciphertext `value` for a secret (spec: "Secret Values Are
 * Write-Only") — `value` is `undefined` on the mapped item in that case.
 */
export interface ConfigListItem {
  parameterId: string
  isSecret: boolean
  updatedAt?: string
  updatedBy?: string
}

export interface ConfigDetail extends ConfigListItem {
  value?: string
}

interface ConfigListItemWire {
  parameter_id: string
  is_secret: boolean
  updated_at?: string
  updated_by?: string
}

interface ConfigDetailWire extends ConfigListItemWire {
  value?: string
}

interface ConfigListResponse {
  items: ConfigListItemWire[]
}

function toConfigListItem (wire: ConfigListItemWire): ConfigListItem {
  return { parameterId: wire.parameter_id, isSecret: wire.is_secret, updatedAt: wire.updated_at, updatedBy: wire.updated_by }
}

function toConfigDetail (wire: ConfigDetailWire): ConfigDetail {
  return { ...toConfigListItem(wire), value: wire.value }
}

/** `GET /api/admin/config` — empty table returns `[]`, never an error (spec: List Config Entries). */
export async function listConfig (): Promise<ConfigListItem[]> {
  const response = await apiFetch<ConfigListResponse>('/api/admin/config')
  return response.items.map(toConfigListItem)
}

/** `GET /api/admin/config/:id` — `value` present only when `isSecret === false`. */
export async function getConfig (parameterId: string): Promise<ConfigDetail> {
  const response = await apiFetch<ConfigDetailWire>(`/api/admin/config/${encodeURIComponent(parameterId)}`)
  return toConfigDetail(response)
}

export interface AddConfigInput {
  parameterId: string
  value: string
  isSecret: boolean
}

/**
 * `POST /api/admin/config` — the server rejects a duplicate `parameter_id`
 * with `409 already_exists` (spec: "MUST NOT silently overwrite a key on
 * add"); callers surface that `ApiError` as a clear "this key already
 * exists" message rather than retrying as an update automatically.
 */
export async function addConfig (input: AddConfigInput): Promise<void> {
  await apiFetch('/api/admin/config', {
    method: 'POST',
    body: { parameter_id: input.parameterId, value: input.value, is_secret: input.isSecret }
  })
}

export interface UpdateConfigInput {
  value?: string
  isSecret?: boolean
}

/**
 * `PUT /api/admin/config/:id` — explicit update action (spec: "requires an
 * explicit update action to change an existing key"). `isSecret` defaults
 * to `undefined` (omitted/untouched) so the edit screen never has to
 * resend the existing type and risk a `409 type_mismatch`.
 */
export async function updateConfig (parameterId: string, input: UpdateConfigInput): Promise<void> {
  await apiFetch(`/api/admin/config/${encodeURIComponent(parameterId)}`, {
    method: 'PUT',
    body: { value: input.value, is_secret: input.isSecret }
  })
}

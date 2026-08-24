import { apiFetch } from './client'

/**
 * Typed BFF user client (design.md "API contract" — Phase 3, all under
 * `/api/admin/users`). Wire shapes read directly from
 * `titvo-admin-bff-aws/src/infrastructure/user/users.handler.ts` (Work Unit
 * 6). `password_hash` is never part of any response shape here — the BFF's
 * `toListWireShape`/create/update responses have no such field at all.
 */
export type UserRole = 'admin' | 'member'
export type UserStatus = 'active' | 'inactive'

export interface UserListItem {
  userId: string
  email: string
  role: UserRole
  status: UserStatus
  createdAt?: string
  updatedAt?: string
}

interface UserListItemWire {
  user_id: string
  email: string
  role: UserRole
  status: UserStatus
  created_at?: string
  updated_at?: string
}

interface UserListResponse {
  items: UserListItemWire[]
}

function toUserListItem (wire: UserListItemWire): UserListItem {
  return {
    userId: wire.user_id,
    email: wire.email,
    role: wire.role,
    status: wire.status,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at
  }
}

/** `GET /api/admin/users` — readable by both `admin` and `member` (spec: List Users). */
export async function listUsers (): Promise<UserListItem[]> {
  const response = await apiFetch<UserListResponse>('/api/admin/users')
  return response.items.map(toUserListItem)
}

export interface CreatedUser {
  userId: string
  email: string
  role: UserRole
}

interface CreatedUserWire {
  user_id: string
  email: string
  role: UserRole
}

/**
 * `POST /api/admin/users` — admin-only (BFF 403s a member); 400
 * `invalid_request` on a missing/short password; 409 `already_exists` on
 * an email collision. Spec: Admin-Set-Password Invite — no email/SMTP
 * flow, the admin sets the initial password directly.
 */
export async function createUser (email: string, password: string, role: UserRole): Promise<CreatedUser> {
  const response = await apiFetch<CreatedUserWire>('/api/admin/users', {
    method: 'POST',
    body: { email, password, role }
  })
  return { userId: response.user_id, email: response.email, role: response.role }
}

export interface UpdatedUser {
  userId: string
  email: string
  role: UserRole
  status: UserStatus
}

interface UpdatedUserWire {
  user_id: string
  email: string
  role: UserRole
  status: UserStatus
}

export interface UpdateUserInput {
  role?: UserRole
  status?: UserStatus
}

/**
 * `PATCH /api/admin/users/:id` — admin-only. A single combined endpoint
 * for role reassignment and deactivation/reactivation (Work Unit 6 design
 * deviation — one endpoint, not separate `/deactivate`/`/role` routes).
 * `409 last_admin` when the change would leave zero active admins;
 * `404 not_found` for an unknown user.
 */
export async function updateUser (userId: string, input: UpdateUserInput): Promise<UpdatedUser> {
  const response = await apiFetch<UpdatedUserWire>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: input
  })
  return { userId: response.user_id, email: response.email, role: response.role, status: response.status }
}

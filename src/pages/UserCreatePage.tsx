import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { createUser, UserRole } from '../api/users'
import { ApiError } from '../api/client'
import { AppShell } from '../components/AppShell'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { cn } from '../lib/utils'

function submitErrorMessage (error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === 'already_exists') return t('users.errorAlreadyExists')
    if (error.status === 400) return t('users.errorInvalidPassword')
    if (error.status === 403) return t('common.noPermissionAction')
  }
  return t('common.somethingWentWrong')
}

function emailValidator (value: string, t: TFunction): string | null {
  return value.trim().length === 0 ? t('common.requiredField') : null
}

function passwordValidator (value: string, t: TFunction): string | null {
  if (value.length === 0) return t('common.requiredField')
  if (value.length < 8) return t('users.passwordTooShort')
  return null
}

/**
 * Create-user form (spec: Admin-Set-Password Invite — admin sets the
 * initial password directly, no email/SMTP). Unlike `ApiKeyCreatePage`
 * there is no show-once reveal modal here: the admin already knows the
 * value they typed into the password field, so there is nothing generated
 * server-side to display back to them. The password never round-trips
 * back from `createUser` (`CreatedUser` has no such field) and is never
 * held in state beyond this form's own local `password` value, which is
 * discarded on navigate-away like any other unmounted form field.
 *
 * The role field is a plain native `<select>` (Tailwind-styled to match
 * `Input`), not shadcn's Radix-based `Select` (see `ui/select.tsx`) — a
 * deliberate choice for this one two-option field: it keeps native
 * `<select>` semantics (`toHaveValue`, `userEvent.selectOptions`) that
 * the rest of the app's forms can rely on, with none of Radix Select's
 * portal/pointer-capture behavior to account for in jsdom.
 */
export function UserCreatePage (): React.ReactElement | null {
  const { user, status } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [role, setRole] = useState<UserRole>('member')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'loading') {
    return null
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/users" replace />
  }

  const emailError = emailTouched ? emailValidator(email, t) : null
  const passwordError = passwordTouched ? passwordValidator(password, t) : null

  async function handleSubmit (event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      const created = await createUser(email, password, role)
      navigate('/users', { state: { flash: { type: 'success', text: t('users.createdFlash', { email: created.email }) } } })
    } catch (error) {
      setSubmitError(submitErrorMessage(error, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <Link to="/users" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('users.backToUsers')}
      </Link>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t('users.createTitle')}</h1>

      <Card className="max-w-lg">
        <CardContent className="pt-6">
          <form onSubmit={event => { void handleSubmit(event) }} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t('users.email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                onBlur={() => setEmailTouched(true)}
                disabled={submitting}
                required
                autoFocus
                autoComplete="off"
                aria-invalid={emailError !== null}
              />
              {emailError !== null && <p className="text-xs text-destructive">{emailError}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t('users.initialPassword')}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                onBlur={() => setPasswordTouched(true)}
                disabled={submitting}
                required
                autoComplete="new-password"
                aria-invalid={passwordError !== null}
                aria-describedby="password-hint"
              />
              {passwordError !== null
                ? <p className="text-xs text-destructive">{passwordError}</p>
                : <p id="password-hint" className="text-xs text-muted-foreground">{t('users.passwordHint')}</p>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="role">{t('users.roleLabel')}</Label>
              <select
                id="role"
                name="role"
                value={role}
                onChange={event => setRole(event.target.value as UserRole)}
                disabled={submitting}
                className={cn(
                  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'
                )}
              >
                <option value="member">{t('users.member')}</option>
                <option value="admin">{t('users.admin')}</option>
              </select>
            </div>

            {submitError !== null && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? t('common.creating') : t('common.create')}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/users')} disabled={submitting}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  )
}

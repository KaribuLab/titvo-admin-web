import React, { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { createApiKey, CreatedApiKey } from '../api/apiKeys'
import { ApiError } from '../api/client'
import { AppShell } from '../components/AppShell'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { RawKeyModal } from '../components/RawKeyModal'

function submitErrorMessage (error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return t('apiKeys.errorLabelRequired')
    if (error.status === 403) return t('common.noPermissionAction')
  }
  return t('common.somethingWentWrong')
}

function requiredValidator (value: string, t: TFunction): string | null {
  return value.trim().length === 0 ? t('common.requiredField') : null
}

/**
 * Create-key form + one-time reveal (spec: Create Key With Show-Once Raw
 * Value / Raw Key Permanently Unavailable). `createdKey` is the ONLY
 * place in this screen that ever holds the raw value, and it exists only
 * between a successful create and the user dismissing `RawKeyModal` —
 * `handleDismiss` clears it (and this whole screen unmounts on the
 * subsequent navigate), so nothing about the raw value outlives the
 * modal or is re-fetchable afterward.
 */
export function ApiKeyCreatePage (): React.ReactElement | null {
  const { user, status } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [label, setLabel] = useState('')
  const [labelTouched, setLabelTouched] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [createdKey, setCreatedKey] = useState<CreatedApiKey | null>(null)

  if (status === 'loading') {
    return null
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/api-keys" replace />
  }

  const labelError = labelTouched ? requiredValidator(label, t) : null

  async function handleSubmit (event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      const created = await createApiKey(label)
      setCreatedKey(created)
    } catch (error) {
      setSubmitError(submitErrorMessage(error, t))
    } finally {
      setSubmitting(false)
    }
  }

  function handleDismiss (): void {
    const createdLabel = createdKey?.label ?? label
    setCreatedKey(null)
    navigate('/api-keys', { state: { flash: { type: 'success', text: t('apiKeys.createdFlash', { label: createdLabel }) } } })
  }

  if (createdKey !== null) {
    return (
      <AppShell>
        <RawKeyModal label={createdKey.label} apiKey={createdKey.apiKey} onDismiss={handleDismiss} />
      </AppShell>
    )
  }

  return (
    <AppShell>
      <Link to="/api-keys" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('apiKeys.backToKeys')}
      </Link>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t('apiKeys.createTitle')}</h1>

      <Card className="max-w-lg">
        <CardContent className="pt-6">
          <form onSubmit={event => { void handleSubmit(event) }} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="label">{t('apiKeys.label')}</Label>
              <Input
                id="label"
                name="label"
                value={label}
                onChange={event => setLabel(event.target.value)}
                onBlur={() => setLabelTouched(true)}
                disabled={submitting}
                required
                autoFocus
                aria-invalid={labelError !== null}
                aria-describedby="label-hint"
              />
              {labelError !== null
                ? <p className="text-xs text-destructive">{labelError}</p>
                : <p id="label-hint" className="text-xs text-muted-foreground">{t('apiKeys.labelHint')}</p>}
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
              <Button type="button" variant="secondary" onClick={() => navigate('/api-keys')} disabled={submitting}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  )
}

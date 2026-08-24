import React, { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ArrowLeft, Lock } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { addConfig, ConfigDetail, getConfig, updateConfig } from '../api/config'
import { ApiError } from '../api/client'
import { AppShell } from '../components/AppShell'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Checkbox } from '../components/ui/checkbox'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'

function submitErrorMessage (error: unknown, mode: 'add' | 'edit', t: TFunction): string {
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === 'already_exists') return t('config.errorAlreadyExists')
    if (error.status === 409 && error.code === 'type_mismatch') return t('config.errorTypeMismatch')
    if (error.status === 503) return t('config.errorEncryptionUnavailable')
    if (error.status === 403) return t('common.noPermissionAction')
    if (error.status === 404 && mode === 'edit') return t('config.errorNoLongerExists')
  }
  return t('common.somethingWentWrong')
}

function requiredValidator (value: string, t: TFunction): string | null {
  return value.trim().length === 0 ? t('common.requiredField') : null
}

/**
 * Add/update form for a single config entry (spec: admin-config-management
 * / Add and Update Config Entries, Secret Values Are Write-Only). Add and
 * edit are two explicit, distinct actions — there is no overloaded
 * "save" that silently clobbers an existing key. `parameterId` and
 * `isSecret` are immutable once a key exists: editing only ever changes
 * `value`, so this screen can never trigger the server's `type_mismatch`
 * guard.
 */
export function ConfigFormPage (): React.ReactElement | null {
  const { user, status } = useAuth()
  const { t } = useTranslation()
  const { parameterId } = useParams<{ parameterId?: string }>()
  const navigate = useNavigate()
  const mode: 'add' | 'edit' = parameterId === undefined ? 'add' : 'edit'

  const [newParameterId, setNewParameterId] = useState('')
  const [keyTouched, setKeyTouched] = useState(false)
  const [value, setValue] = useState('')
  const [valueTouched, setValueTouched] = useState(false)
  const [isSecret, setIsSecret] = useState(false)
  const [existing, setExisting] = useState<ConfigDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (mode !== 'edit' || parameterId === undefined) return
    let cancelled = false
    getConfig(parameterId)
      .then(detail => {
        if (cancelled) return
        setExisting(detail)
        // Never pre-fill a secret's value (write-only); a plaintext value
        // is safe to pre-fill since the server already returns it.
        setValue(detail.isSecret ? '' : (detail.value ?? ''))
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(submitErrorMessage(error, 'edit', t))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, parameterId])

  if (status === 'loading') {
    return null
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/config" replace />
  }

  if (mode === 'edit' && loadError !== null) {
    return (
      <AppShell>
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </AppShell>
    )
  }

  if (mode === 'edit' && existing === null) {
    return (
      <AppShell>
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      </AppShell>
    )
  }

  const keyError = keyTouched ? requiredValidator(newParameterId, t) : null
  const valueError = valueTouched ? requiredValidator(value, t) : null

  async function handleSubmit (event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setSubmitError(null)
    setSubmitting(true)
    try {
      if (mode === 'add') {
        await addConfig({ parameterId: newParameterId, value, isSecret })
        navigate('/config', { state: { flash: { type: 'success', text: t('config.addedFlash', { key: newParameterId }) } } })
      } else if (parameterId !== undefined) {
        await updateConfig(parameterId, { value })
        navigate('/config', { state: { flash: { type: 'success', text: t('config.updatedFlash', { key: parameterId }) } } })
      }
    } catch (error) {
      setSubmitError(submitErrorMessage(error, mode, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppShell>
      <Link to="/config" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('config.backToConfig')}
      </Link>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {mode === 'add' ? t('config.addTitle') : t('config.updateTitle')}
      </h1>

      <Card className="max-w-lg">
        <CardContent className="pt-6">
          <form onSubmit={event => { void handleSubmit(event) }} noValidate className="flex flex-col gap-4">
            {mode === 'add'
              ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="parameterId">{t('config.keyLabel')}</Label>
                  <Input
                    id="parameterId"
                    name="parameterId"
                    value={newParameterId}
                    onChange={event => setNewParameterId(event.target.value)}
                    onBlur={() => setKeyTouched(true)}
                    disabled={submitting}
                    required
                    autoFocus
                    className="font-mono"
                    aria-invalid={keyError !== null}
                    aria-describedby="parameterId-hint"
                  />
                  {keyError !== null
                    ? <p className="text-xs text-destructive">{keyError}</p>
                    : <p id="parameterId-hint" className="text-xs text-muted-foreground">{t('config.keyHint')}</p>}
                </div>
                )
              : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('config.keyLabel')}</span>
                    <span className="font-mono">{existing?.parameterId}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{t('config.type')}</span>
                    <span className="inline-flex items-center gap-1">
                      {existing?.isSecret === true && <Lock className="h-3.5 w-3.5" />}
                      {existing?.isSecret === true ? t('config.secret') : t('config.plaintext')}
                    </span>
                  </div>
                </>
                )}

            {mode === 'add' && (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="isSecret"
                  name="isSecret"
                  checked={isSecret}
                  onCheckedChange={checked => setIsSecret(checked === true)}
                  disabled={submitting}
                  className="mt-0.5"
                />
                <Label htmlFor="isSecret" className="flex flex-col gap-0.5 font-normal">
                  {t('config.secretLabel')}
                  <span className="text-xs font-normal text-muted-foreground">{t('config.secretHint')}</span>
                </Label>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="value">{t('config.valueLabel')}</Label>
              <Input
                id="value"
                name="value"
                type={mode === 'edit' && existing?.isSecret === true ? 'password' : 'text'}
                value={value}
                onChange={event => setValue(event.target.value)}
                onBlur={() => setValueTouched(true)}
                placeholder={mode === 'edit' && existing?.isSecret === true ? t('config.valuePlaceholder') : undefined}
                disabled={submitting}
                required
                aria-invalid={valueError !== null}
              />
              {valueError !== null && <p className="text-xs text-destructive">{valueError}</p>}
            </div>

            {submitError !== null && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? t('common.saving') : (mode === 'add' ? t('common.add') : t('common.update'))}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/config')} disabled={submitting}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AppShell>
  )
}

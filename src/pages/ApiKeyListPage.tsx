import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Inbox, KeyRound, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { ApiKeyListItem, listApiKeys, revokeApiKey } from '../api/apiKeys'
import { ApiError } from '../api/client'
import { AppShell } from '../components/AppShell'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../components/ui/alert-dialog'
import type { FlashMessage } from '../lib/flash'

function errorMessage (error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.status === 403) return t('common.noPermissionView')
  return t('apiKeys.errorCouldNotLoad')
}

function revokeErrorMessage (error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === 'last_active_key') {
      return t('apiKeys.errorLastActiveKey')
    }
    if (error.status === 404) return t('apiKeys.errorNoLongerExists')
    if (error.status === 403) return t('common.noPermissionAction')
  }
  return t('apiKeys.errorCouldNotRevoke')
}

/**
 * API key list screen (spec: admin-apikey-management). `member` sees the
 * same metadata-only list but no create/revoke controls are rendered at
 * all — not disabled (design D8, spec: Member attempts write). Revoking
 * is a two-step, destructive action gated by a shadcn `AlertDialog`:
 * "Revoke" only opens the confirm dialog for that one row; "Confirm
 * revoke" is the action that actually calls the BFF. A `409
 * last_active_key` block is surfaced verbatim, not silently swallowed
 * (design risk resolution #1).
 */
export function ApiKeyListPage (): React.ReactElement {
  const { user } = useAuth()
  const { t } = useTranslation()
  const canWrite = user?.role === 'admin'
  const [items, setItems] = useState<ApiKeyListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const state = location.state as { flash?: FlashMessage } | null
    const flash = state?.flash
    if (flash === undefined) return
    toast[flash.type](flash.text)
    // Clear the router state so a refresh or back-navigation never replays it.
    navigate(location.pathname, { replace: true, state: {} })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function load (): void {
    listApiKeys()
      .then(result => setItems(result))
      .catch((loadError: unknown) => setError(errorMessage(loadError, t)))
  }

  useEffect(() => {
    let cancelled = false
    listApiKeys()
      .then(result => { if (!cancelled) setItems(result) })
      .catch((loadError: unknown) => { if (!cancelled) setError(errorMessage(loadError, t)) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleConfirmRevoke (keyId: string): Promise<void> {
    setRevokeError(null)
    setRevokingId(keyId)
    try {
      await revokeApiKey(keyId)
      setConfirmingId(null)
      load()
    } catch (revokeErr) {
      setConfirmingId(null)
      setRevokeError(revokeErrorMessage(revokeErr, t))
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('apiKeys.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('apiKeys.subtitle')}</p>
        </div>
        {canWrite && (
          <Button asChild size="sm">
            <Link to="/api-keys/new">
              <Plus /> {t('apiKeys.createKey')}
            </Link>
          </Button>
        )}
      </div>

      {error !== null && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {revokeError !== null && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{revokeError}</AlertDescription>
        </Alert>
      )}

      {error === null && items === null && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      )}

      {error === null && items !== null && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">{t('apiKeys.noKeysYet')}</p>
            {canWrite && <p className="text-sm text-muted-foreground">{t('apiKeys.createFirstKey')}</p>}
          </CardContent>
        </Card>
      )}

      {error === null && items !== null && items.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('apiKeys.label')}</TableHead>
                <TableHead>{t('apiKeys.status')}</TableHead>
                <TableHead>{t('apiKeys.created')}</TableHead>
                {canWrite && <TableHead className="text-right">{t('apiKeys.actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.keyId}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5 text-muted-foreground" /> {item.label}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === 'active' ? 'success' : 'secondary'}>
                      {item.status === 'active' ? t('apiKeys.active') : t('apiKeys.revoked')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.createdAt ?? '—'}</TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      {item.status === 'active' && (
                        <AlertDialog
                          open={confirmingId === item.keyId}
                          onOpenChange={open => setConfirmingId(open ? item.keyId : null)}
                        >
                          <Button variant="destructive" size="sm" onClick={() => setConfirmingId(item.keyId)}>
                            {t('apiKeys.revoke')}
                          </Button>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('apiKeys.revokeConfirmTitle', { label: item.label })}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('apiKeys.revokeConfirmDescription')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={revokingId === item.keyId}>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={revokingId === item.keyId}
                                onClick={event => {
                                  event.preventDefault()
                                  void handleConfirmRevoke(item.keyId)
                                }}
                              >
                                {revokingId === item.keyId ? t('apiKeys.revoking') : t('apiKeys.confirmRevoke')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </AppShell>
  )
}

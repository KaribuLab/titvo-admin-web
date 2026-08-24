import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Inbox, Lock, Pencil, Plus } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { ConfigListItem, listConfig } from '../api/config'
import { ApiError } from '../api/client'
import { AppShell } from '../components/AppShell'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import type { FlashMessage } from '../lib/flash'

function errorMessage (error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    if (error.status === 503) return t('config.errorEncryptionUnavailable')
    if (error.status === 403) return t('common.noPermissionView')
  }
  return t('config.errorCouldNotLoad')
}

/**
 * Config list screen (spec: admin-config-management / List Config Entries,
 * admin-console-web / Role-Aware UI). `member` sessions see the same list
 * but the add/edit controls are omitted from the render tree entirely —
 * not disabled — so there is no submittable control to re-enable via
 * devtools.
 */
export function ConfigListPage (): React.ReactElement {
  const { user } = useAuth()
  const { t } = useTranslation()
  const canWrite = user?.role === 'admin'
  const [items, setItems] = useState<ConfigListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  useEffect(() => {
    let cancelled = false
    listConfig()
      .then(result => {
        if (!cancelled) setItems(result)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(errorMessage(loadError, t))
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('config.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('config.subtitle')}</p>
        </div>
        {canWrite && (
          <Button asChild size="sm">
            <Link to="/config/new">
              <Plus /> {t('config.addNew')}
            </Link>
          </Button>
        )}
      </div>

      {error !== null && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
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
            <p className="text-sm font-medium">{t('config.noEntriesYet')}</p>
            {canWrite && <p className="text-sm text-muted-foreground">{t('config.addFirstKey')}</p>}
          </CardContent>
        </Card>
      )}

      {error === null && items !== null && items.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('config.key')}</TableHead>
                <TableHead>{t('config.type')}</TableHead>
                <TableHead>{t('config.updated')}</TableHead>
                {canWrite && <TableHead className="text-right">{t('config.actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.parameterId}>
                  <TableCell className="font-mono text-xs">{item.parameterId}</TableCell>
                  <TableCell>
                    {item.isSecret
                      ? <Badge variant="warning"><Lock className="mr-1 h-3 w-3" /> {t('config.secret')}</Badge>
                      : <Badge variant="secondary">{t('config.plaintext')}</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.updatedAt ?? '—'}</TableCell>
                  {canWrite && (
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/config/${encodeURIComponent(item.parameterId)}/edit`}>
                          <Pencil /> {t('config.edit')}
                        </Link>
                      </Button>
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

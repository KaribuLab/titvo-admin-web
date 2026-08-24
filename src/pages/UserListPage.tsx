import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Inbox, Plus, User as UserIcon } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { UserListItem, listUsers, updateUser } from '../api/users'
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

type PendingAction = 'deactivate' | 'demote'

function errorMessage (error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.status === 403) return t('common.noPermissionView')
  return t('users.errorCouldNotLoad')
}

/**
 * Same last-admin surfacing convention as the API key screen's `409
 * last_active_key` handling (design risk resolution reused, not
 * reinvented) — a clear, specific banner, never a silently swallowed
 * failure.
 */
function actionErrorMessage (error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === 'last_admin') {
      return t('users.errorLastAdmin')
    }
    if (error.status === 404) return t('users.errorNoLongerExists')
    if (error.status === 403) return t('common.noPermissionAction')
  }
  return t('users.errorCouldNotUpdate')
}

/**
 * User list screen (spec: admin-user-management). `member` sees the same
 * list read-only, no controls rendered at all (spec: Write Access
 * Control). Promoting a member to admin and reactivating an inactive
 * user are safe, reversible, single-click actions — neither can trigger
 * the last-admin block. Deactivating a user and demoting an admin to
 * member are both two-step, confirm-gated actions (shadcn `AlertDialog`,
 * same convention as the API key screen's revoke confirm) because both
 * CAN trigger the platform's last-admin block (spec: Last-Admin
 * Protection) — the resulting `409 last_admin` is surfaced as a clear
 * banner, mirroring the API key screen's `409 last_active_key` convention
 * exactly.
 */
export function UserListPage (): React.ReactElement {
  const { user } = useAuth()
  const { t } = useTranslation()
  const canWrite = user?.role === 'admin'
  const [items, setItems] = useState<UserListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [confirmingAction, setConfirmingAction] = useState<PendingAction | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
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
    listUsers()
      .then(result => setItems(result))
      .catch((loadError: unknown) => setError(errorMessage(loadError, t)))
  }

  useEffect(() => {
    let cancelled = false
    listUsers()
      .then(result => { if (!cancelled) setItems(result) })
      .catch((loadError: unknown) => { if (!cancelled) setError(errorMessage(loadError, t)) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function arm (userId: string, action: PendingAction): void {
    setConfirmingId(userId)
    setConfirmingAction(action)
  }

  function cancelConfirm (): void {
    setConfirmingId(null)
    setConfirmingAction(null)
  }

  async function applyUpdate (userId: string, input: { role?: 'admin' | 'member', status?: 'active' | 'inactive' }): Promise<void> {
    setActionError(null)
    setActionLoadingId(userId)
    try {
      await updateUser(userId, input)
      cancelConfirm()
      load()
    } catch (updateError) {
      cancelConfirm()
      setActionError(actionErrorMessage(updateError, t))
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleConfirm (userId: string): Promise<void> {
    if (confirmingAction === 'deactivate') {
      await applyUpdate(userId, { status: 'inactive' })
    } else if (confirmingAction === 'demote') {
      await applyUpdate(userId, { role: 'member' })
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('users.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('users.subtitle')}</p>
        </div>
        {canWrite && (
          <Button asChild size="sm">
            <Link to="/users/new">
              <Plus /> {t('users.createUser')}
            </Link>
          </Button>
        )}
      </div>

      {error !== null && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {actionError !== null && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{actionError}</AlertDescription>
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
            <p className="text-sm font-medium">{t('users.noUsersYet')}</p>
          </CardContent>
        </Card>
      )}

      {error === null && items !== null && items.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('users.email')}</TableHead>
                <TableHead>{t('users.role')}</TableHead>
                <TableHead>{t('users.status')}</TableHead>
                {canWrite && <TableHead className="text-right">{t('users.actions')}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => {
                const isConfirming = confirmingId === item.userId
                return (
                  <TableRow key={item.userId}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-1.5"><UserIcon className="h-3.5 w-3.5 text-muted-foreground" /> {item.email}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.role === 'admin' ? 'default' : 'secondary'}>
                        {item.role === 'admin' ? t('users.admin') : t('users.member')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === 'active' ? 'success' : 'secondary'} className="capitalize">{item.status}</Badge>
                    </TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {item.role === 'member' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={actionLoadingId === item.userId}
                              onClick={() => { void applyUpdate(item.userId, { role: 'admin' }) }}
                            >
                              {t('users.makeAdmin')}
                            </Button>
                          )}
                          {item.role === 'admin' && (
                            <Button variant="secondary" size="sm" onClick={() => arm(item.userId, 'demote')}>
                              {t('users.makeMember')}
                            </Button>
                          )}
                          {item.status === 'inactive' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={actionLoadingId === item.userId}
                              onClick={() => { void applyUpdate(item.userId, { status: 'active' }) }}
                            >
                              {t('users.reactivate')}
                            </Button>
                          )}
                          {item.status === 'active' && (
                            <Button variant="destructive" size="sm" onClick={() => arm(item.userId, 'deactivate')}>
                              {t('users.deactivate')}
                            </Button>
                          )}
                        </div>

                        <AlertDialog
                          open={isConfirming}
                          onOpenChange={open => { if (!open) cancelConfirm() }}
                        >
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {confirmingAction === 'deactivate' ? t('users.deactivateConfirmTitle', { email: item.email }) : t('users.demoteConfirmTitle', { email: item.email })}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {confirmingAction === 'deactivate' ? t('users.willLoseAccess') : t('users.willLoseAdmin')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel disabled={actionLoadingId === item.userId}>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={actionLoadingId === item.userId}
                                onClick={event => {
                                  event.preventDefault()
                                  void handleConfirm(item.userId)
                                }}
                              >
                                {actionLoadingId === item.userId
                                  ? t('common.saving')
                                  : (confirmingAction === 'deactivate' ? t('users.confirmDeactivate') : t('users.confirmRoleChange'))}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </AppShell>
  )
}

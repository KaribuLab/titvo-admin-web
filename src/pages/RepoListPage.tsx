import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ChevronRight, Inbox, Play, Search } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { listRepos, RepoListItem } from '../api/repos'
import { listScansForRepo, triggerScan, getDefaultBranch, ScanSummary } from '../api/scans'
import { ApiError } from '../api/client'
import { AppShell } from '../components/AppShell'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Checkbox } from '../components/ui/checkbox'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { scanStatusBadgeVariant, scanStatusLabel, scanStatusTone } from '../lib/scanStatus'

const DEFAULT_BRANCH = 'main'

/** Providers `POST /api/admin/repos/:id/trigger-scan` supports today (GitHub + Bitbucket parity). */
const SCAN_TRIGGERABLE_PROVIDERS = new Set(['github', 'bitbucket'])

function errorMessage (error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.status === 403) return t('common.noPermissionView')
  return t('repos.couldNotLoad')
}

function triggerScanErrorMessage (error: unknown, t: TFunction): string {
  if (error instanceof ApiError) {
    // `config_missing` carries the BFF's own actionable text naming the
    // exact missing parameter (e.g. `default_github_assignee`,
    // `bitbucket_api_token`) — surface it verbatim rather than a generic
    // message. That text comes from the BFF in whatever language it was
    // authored in (English) — deliberately never re-translated client-side.
    if (error.code === 'config_missing' && error.message.length > 0) return error.message
    if (error.status === 403) return t('common.noPermissionAction')
    if (error.status === 404) return t('repos.errorRepoNoLongerExists')
    if (error.status === 422 && error.code === 'unsupported_provider') return t('repos.errorUnsupportedProvider')
    if (error.status === 422 && error.code === 'branch_resolution_failed') return t('repos.errorBranchResolutionFailed')
    if (error.status === 422) return t('repos.errorCouldNotStart')
    if (error.status === 502) return t('repos.errorServiceUnavailable')
  }
  return t('repos.errorGeneric')
}

type HistoryState = 'loading' | ScanSummary[] | 'error'

function displayName (repo: RepoListItem): string {
  return repo.name ?? repo.repositoryId
}

/**
 * Repo list screen (spec: admin-repo-visibility). Read-accessible to both
 * `admin` and `member` — no role gate for viewing, unlike the config
 * screens. A repo with `lastScan: null` renders a "Never scanned" state
 * (spec: Repo never scanned); this is deliberately the SAME rendering used
 * during the `repository_id` GSI backfill window, since the BFF makes the
 * two indistinguishable at the wire level (see `api/repos.ts`) — both are
 * legitimate non-error states, so there is no separate "temporarily
 * unavailable" banner.
 *
 * "Run scan" is the one write control on this screen (trigger-a-scan
 * feature): admin-only, and only rendered for providers the BFF actually
 * supports (`SCAN_TRIGGERABLE_PROVIDERS` — GitHub and Bitbucket today; a
 * repo with an unrecognized/missing provider is simply absent the action
 * rather than shown disabled). `member` sessions and unsupported-provider
 * repos see the exact same read-only row every prior batch shipped.
 *
 * The name search below is purely client-side: the full repo list is
 * already fetched in one call, so filtering it in memory needs no new BFF
 * endpoint.
 */
export function RepoListPage (): React.ReactElement {
  const { user } = useAuth()
  const { t } = useTranslation()
  const canTriggerScan = user?.role === 'admin'
  const navigate = useNavigate()

  const [repos, setRepos] = useState<RepoListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [history, setHistory] = useState<Record<string, HistoryState>>({})
  const [query, setQuery] = useState('')

  const [scanDialogRepo, setScanDialogRepo] = useState<RepoListItem | null>(null)
  const [branch, setBranch] = useState(DEFAULT_BRANCH)
  const [branchLoading, setBranchLoading] = useState(false)
  const [fullScan, setFullScan] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [triggerError, setTriggerError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listRepos()
      .then(result => { if (!cancelled) setRepos(result) })
      .catch((loadError: unknown) => { if (!cancelled) setError(errorMessage(loadError, t)) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredRepos = useMemo(() => {
    if (repos === null) return null
    const trimmed = query.trim().toLowerCase()
    if (trimmed.length === 0) return repos
    return repos.filter(repo => displayName(repo).toLowerCase().includes(trimmed))
  }, [repos, query])

  function openScanDialog (repo: RepoListItem): void {
    setScanDialogRepo(repo)
    setBranch(DEFAULT_BRANCH)
    setFullScan(false)
    setTriggerError(null)

    // Best-effort auto-detect of the repo's actual default branch — purely
    // a nicety over the hardcoded "main" guess, never blocks or errors the
    // dialog. Only overwrites the field if the admin hasn't already
    // started editing it (still equals the initial guess) by the time this
    // resolves.
    setBranchLoading(true)
    getDefaultBranch(repo.repositoryId)
      .then(detected => setBranch(current => (current === DEFAULT_BRANCH ? detected : current)))
      .catch(() => { /* non-fatal — keep the "main" guess */ })
      .finally(() => setBranchLoading(false))
  }

  function closeScanDialog (): void {
    if (triggering) return
    setScanDialogRepo(null)
  }

  async function handleTriggerScan (): Promise<void> {
    if (scanDialogRepo === null) return
    setTriggerError(null)
    setTriggering(true)
    try {
      const result = await triggerScan(scanDialogRepo.repositoryId, branch, fullScan ? 'full' : undefined)
      setScanDialogRepo(null)
      toast.success(t('repos.scanStartedFor', { name: displayName(scanDialogRepo) }))
      // Non-blocking: the scan already started successfully above. This is
      // a SEPARATE toast (not folded into the success one) so it stays
      // visible/distinct — the BFF only sends this when it detected the
      // triggered scan's repositoryId won't match this repo's existing
      // history (see TriggerScanUseCase's repositoryId-mismatch check).
      if (result.warning !== undefined) {
        toast.warning(result.warning)
      }
      navigate(`/scans/${encodeURIComponent(result.scanId)}`)
    } catch (triggerErr) {
      setTriggerError(triggerScanErrorMessage(triggerErr, t))
    } finally {
      setTriggering(false)
    }
  }

  function toggleHistory (repositoryId: string): void {
    if (expandedId === repositoryId) {
      setExpandedId(null)
      return
    }
    setExpandedId(repositoryId)
    if (history[repositoryId] !== undefined) return
    setHistory(prev => ({ ...prev, [repositoryId]: 'loading' }))
    listScansForRepo(repositoryId)
      .then(items => setHistory(prev => ({ ...prev, [repositoryId]: items })))
      .catch(() => setHistory(prev => ({ ...prev, [repositoryId]: 'error' })))
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('repos.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('repos.subtitle')}</p>
        </div>
        {repos !== null && repos.length > 0 && (
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label={t('repos.searchLabel')}
              placeholder={t('repos.searchPlaceholder')}
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="pl-8"
            />
          </div>
        )}
      </div>

      {error !== null && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {error === null && repos === null && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      )}

      {error === null && repos !== null && repos.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Inbox className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">{t('repos.noRepositoriesConnected')}</p>
          </CardContent>
        </Card>
      )}

      {error === null && repos !== null && repos.length > 0 && filteredRepos !== null && filteredRepos.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Search className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">{t('repos.noRepositoriesMatch', { query })}</p>
          </CardContent>
        </Card>
      )}

      {error === null && filteredRepos !== null && filteredRepos.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('repos.repository')}</TableHead>
                <TableHead>{t('repos.provider')}</TableHead>
                <TableHead>{t('repos.lastScan')}</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRepos.map(repo => {
                const repoHistory = history[repo.repositoryId]
                const isExpanded = expandedId === repo.repositoryId
                return (
                  <React.Fragment key={repo.repositoryId}>
                    <TableRow>
                      <TableCell className="font-medium">{displayName(repo)}</TableCell>
                      <TableCell className="text-muted-foreground">{repo.provider ?? '—'}</TableCell>
                      <TableCell>
                        {repo.lastScan === null
                          ? <Badge variant="secondary">{t('repos.neverScanned')}</Badge>
                          : (
                            <Link to={`/scans/${encodeURIComponent(repo.lastScan.scanId)}`}>
                              <Badge variant={scanStatusBadgeVariant(scanStatusTone(repo.lastScan.status, repo.lastScan.executionStatus))}>
                                {scanStatusLabel(repo.lastScan.status, repo.lastScan.executionStatus)}
                              </Badge>
                            </Link>
                            )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canTriggerScan && repo.provider !== undefined && SCAN_TRIGGERABLE_PROVIDERS.has(repo.provider) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openScanDialog(repo)}
                              aria-label={t('repos.runScanFor', { name: displayName(repo) })}
                            >
                              <Play className="h-3.5 w-3.5" /> {t('repos.runScan')}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleHistory(repo.repositoryId)}
                            aria-label={`${isExpanded ? t('repos.hideHistory') : t('repos.showHistory')} ${t('repos.scanHistoryFor', { name: displayName(repo) })}`}
                          >
                            {t('repos.history')} <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-muted/30">
                          {repoHistory === 'loading' && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Skeleton className="h-4 w-4 rounded-full" /><span>{t('repos.loadingHistory')}</span>
                            </div>
                          )}
                          {repoHistory === 'error' && (
                            <Alert variant="destructive"><AlertDescription>{t('repos.couldNotLoadHistory')}</AlertDescription></Alert>
                          )}
                          {Array.isArray(repoHistory) && repoHistory.length === 0 && (
                            <p className="text-sm text-muted-foreground">{t('repos.noScansRecorded')}</p>
                          )}
                          {Array.isArray(repoHistory) && repoHistory.length > 0 && (
                            <ul className="flex flex-col gap-2">
                              {repoHistory.map(scan => (
                                <li key={scan.scanId} className="flex items-center gap-3">
                                  <Link to={`/scans/${encodeURIComponent(scan.scanId)}`}>
                                    <Badge variant={scanStatusBadgeVariant(scanStatusTone(scan.status, scan.executionStatus))}>
                                      {scanStatusLabel(scan.status, scan.executionStatus)}
                                    </Badge>
                                  </Link>
                                  <span className="text-sm text-muted-foreground">{scan.createdAt ?? '—'}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={scanDialogRepo !== null} onOpenChange={open => { if (!open) closeScanDialog() }}>
        {scanDialogRepo !== null && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('repos.runScanDialogTitle', { name: displayName(scanDialogRepo) })}</DialogTitle>
              <DialogDescription>
                {t('repos.runScanDialogDescription')}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch">{t('repos.branch')}</Label>
              <Input
                id="branch"
                name="branch"
                value={branch}
                onChange={event => setBranch(event.target.value)}
                disabled={triggering}
                autoFocus
              />
              {branchLoading && <p className="text-xs text-muted-foreground">{t('repos.detectingDefaultBranch')}</p>}
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="full-scan"
                checked={fullScan}
                onCheckedChange={checked => setFullScan(checked === true)}
                disabled={triggering}
              />
              <Label htmlFor="full-scan" className="text-sm font-normal">
                {t('repos.fullScanDescription')}
              </Label>
            </div>

            {triggerError !== null && (
              <Alert variant="destructive">
                <AlertDescription>{triggerError}</AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={closeScanDialog} disabled={triggering}>
                {t('common.cancel')}
              </Button>
              <Button onClick={() => { void handleTriggerScan() }} disabled={triggering || branch.trim().length === 0}>
                {triggering ? t('repos.starting') : t('repos.runScan')}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </AppShell>
  )
}

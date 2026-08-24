import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { ArrowLeft, Braces, Clock, FileJson2, FolderGit2, GitBranch, Hash, Layers } from 'lucide-react'
import { getScan, ScanDetail } from '../api/scans'
import { ApiError } from '../api/client'
import { AppShell } from '../components/AppShell'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Skeleton } from '../components/ui/skeleton'
import { scanStatusBadgeVariant, scanStatusLabel, scanStatusTone } from '../lib/scanStatus'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { reducedMotionTransition, springSmooth } from '../lib/motion'

function errorMessage (error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.status === 404) return t('scanDetail.noLongerExists')
  return t('scanDetail.couldNotLoad')
}

/**
 * One labeled fact in the meta grid — built on shadcn's own `Card`
 * (not a hand-rolled bordered `div`) so every box on this screen, down to
 * the smallest one, is the same primitive the rest of the app already
 * uses.
 */
function MetaItem ({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>, label: string, children: React.ReactNode }): React.ReactElement {
  return (
    <Card className="bg-muted/40 shadow-none">
      <CardContent className="flex items-start gap-2.5 p-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="truncate text-sm font-medium">{children}</span>
        </div>
      </CardContent>
    </Card>
  )
}

/** A titled JSON panel for `args`/`result` — a shadcn `Card` with a compact `CardHeader`, same as `MetaItem`. */
function JsonPanel ({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>, label: string, value: unknown }): React.ReactElement {
  return (
    <Card className="overflow-hidden bg-muted/40 shadow-none">
      <CardHeader className="flex-row items-center gap-2 space-y-0 border-b border-border/60 bg-muted/40 p-3">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      </CardHeader>
      <CardContent className="p-0">
        <pre className="max-h-80 overflow-auto bg-muted/20 p-3 font-mono text-xs leading-relaxed">{JSON.stringify(value, null, 2)}</pre>
      </CardContent>
    </Card>
  )
}

/**
 * Scan detail screen (spec: admin-repo-visibility / Scan Detail View).
 * Read-accessible to both `admin` and `member`; no rescan/trigger control
 * anywhere on this screen (spec: Empty and Read-Only Boundaries).
 *
 * Visual pass: brought up to the same language the Dashboard/RepoList
 * screens already use (Apple Design entrance motion, icon-labeled meta
 * items instead of plain label/value rows, a status-tone accent border on
 * the header card mirroring `RepoTile`'s treatment) — this screen was the
 * one page still on the older bare `Field`-row layout.
 */
export function ScanDetailPage (): React.ReactElement {
  const { scanId } = useParams<{ scanId: string }>()
  const { t } = useTranslation()
  const [scan, setScan] = useState<ScanDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (scanId === undefined) return
    let cancelled = false
    getScan(scanId)
      .then(result => { if (!cancelled) setScan(result) })
      .catch((loadError: unknown) => { if (!cancelled) setError(errorMessage(loadError, t)) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId])

  const tone = scan !== null ? scanStatusTone(scan.status) : 'neutral'

  return (
    <AppShell>
      <Link to="/repos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('scanDetail.backToRepos')}
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('scanDetail.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('scanDetail.subtitle')}</p>
      </div>

      {error !== null && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {error === null && scan === null && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <Skeleton className="h-6 w-1/3" />
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-3">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          </CardContent>
        </Card>
      )}

      {error === null && scan !== null && (
        <motion.div
          className="max-w-3xl"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducedMotion ? reducedMotionTransition : springSmooth}
        >
          <Card className="overflow-hidden">
            <CardContent className="flex flex-col gap-5 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-mono text-sm font-medium">{scan.scanId}</span>
                </div>
                <Badge variant={scanStatusBadgeVariant(tone)} className="text-sm">
                  {scanStatusLabel(scan.status)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <MetaItem icon={FolderGit2} label={t('scanDetail.repository')}>{scan.repositoryId}</MetaItem>
                {scan.source !== undefined && <MetaItem icon={Layers} label={t('scanDetail.source')}>{scan.source}</MetaItem>}
                {scan.branch !== undefined && <MetaItem icon={GitBranch} label={t('scanDetail.branch')}>{scan.branch}</MetaItem>}
                <MetaItem icon={Clock} label={t('scanDetail.created')}>{scan.createdAt ?? '—'}</MetaItem>
                <MetaItem icon={Clock} label={t('scanDetail.updated')}>{scan.updatedAt ?? '—'}</MetaItem>
              </div>

              {(scan.args !== undefined || scan.result !== undefined) && (
                <div className="flex flex-col gap-4 pt-1">
                  {scan.args !== undefined && <JsonPanel icon={Braces} label={t('scanDetail.args')} value={scan.args} />}
                  {scan.result !== undefined && <JsonPanel icon={FileJson2} label={t('scanDetail.result')} value={scan.result} />}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AppShell>
  )
}

import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Activity, ChevronRight, GitBranch, Inbox, KeyRound, Users } from 'lucide-react'
import { listRepos, RepoListItem } from '../api/repos'
import { listScansForRepo, ScanSummary } from '../api/scans'
import { listApiKeys } from '../api/apiKeys'
import { listUsers } from '../api/users'
import { AppShell } from '../components/AppShell'
import { StatTile } from '../components/StatTile'
import { Sparkline } from '../components/Sparkline'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { Alert, AlertDescription } from '../components/ui/alert'
import { scanStatusBadgeVariant, scanStatusLabel, scanStatusTone } from '../lib/scanStatus'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { reducedMotionTransition, springSmooth, springSnappy } from '../lib/motion'
import {
  aggregateScanStats,
  bucketScansByDay,
  computeKeyStats,
  computeRepoStats,
  computeUserStats,
  hasMeaningfulTrend,
  pickLatestScan,
  DayBucket,
  KeyStats,
  RepoScanEntry,
  RepoStats,
  ScanStats,
  UserStats
} from '../lib/dashboardStats'

interface DashboardData {
  repos: RepoListItem[]
  latest: RepoScanEntry | null
  scanStats: ScanStats
  repoStats: RepoStats
  keyStats: KeyStats
  userStats: UserStats
  trendBuckets: DayBucket[]
}

/**
 * Loads everything the Dashboard renders from the existing typed API
 * clients only — no new BFF endpoints. `listScansForRepo` is called once
 * per connected repo (the same call `RepoListPage`'s 'History' expand
 * already makes) to get real per-status totals and an honest latest-scan
 * pick; `listRepos()`'s own embedded `lastScan` alone isn't enough for
 * that (spec: derive 'most recent scan across repos' from real data).
 */
async function loadDashboardData (): Promise<DashboardData> {
  const lab = import.meta.env.VITE_TITVO_LAB === 'true'
  const [repos, keys, users] = await Promise.all([listRepos(), lab ? Promise.resolve([]) : listApiKeys(), lab ? Promise.resolve([]) : listUsers()])
  const scanLists = await Promise.all(repos.map(async repo => await listScansForRepo(repo.repositoryId)))

  const scansByRepo: Record<string, ScanSummary[]> = {}
  const entries: RepoScanEntry[] = []
  const allScans: ScanSummary[] = []

  repos.forEach((repo, index) => {
    const scans = scanLists[index]
    scansByRepo[repo.repositoryId] = scans
    scans.forEach(scan => {
      entries.push({ repo, scan })
      allScans.push(scan)
    })
  })

  return {
    repos,
    latest: pickLatestScan(entries),
    scanStats: aggregateScanStats(allScans),
    repoStats: computeRepoStats(repos, scansByRepo),
    keyStats: computeKeyStats(keys),
    userStats: computeUserStats(users),
    trendBuckets: bucketScansByDay(allScans, 7)
  }
}

function repoDisplayName (repo: RepoListItem): string {
  return repo.name ?? repo.repositoryId
}

function RepoTile ({ repo }: { repo: RepoListItem }): React.ReactElement {
  const { t } = useTranslation()
  const tone = repo.lastScan === null ? 'neutral' : scanStatusTone(repo.lastScan.status, repo.lastScan.executionStatus)
  const label = repo.lastScan === null ? t('dashboard.neverScanned') : scanStatusLabel(repo.lastScan.status, repo.lastScan.executionStatus)
  const href = repo.lastScan === null ? '/repos' : `/scans/${encodeURIComponent(repo.lastScan.scanId)}`

  return (
    <Link
      to={href}
      className='flex flex-col gap-2 rounded-lg bg-card p-3 shadow-sm transition-colors hover:bg-accent/50'
    >
      <span className='truncate text-sm font-medium'>{repoDisplayName(repo)}</span>
      <Badge variant={scanStatusBadgeVariant(tone)} className='w-fit'>{label}</Badge>
    </Link>
  )
}

function HeroSkeleton (): React.ReactElement {
  return (
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4' aria-hidden='true'>
      {[0, 1, 2, 3].map(key => <Skeleton key={key} className='h-20 rounded-lg' />)}
    </div>
  )
}

/**
 * Repository status panel: a mosaic of one tile per connected repo, colored
 * by its last-scan status via the SAME status→tone mapping `RepoListPage`
 * uses — no new status colors invented here.
 */
function RepoStatusHero ({ repos, loading }: { repos: RepoListItem[] | null, loading: boolean }): React.ReactElement {
  const reducedMotion = usePrefersReducedMotion()
  const { t } = useTranslation()

  return (
    <motion.section
      className='rounded-xl border bg-muted/30 p-5'
      aria-label={t('dashboard.repoStatusTitle')}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? reducedMotionTransition : springSmooth}
    >
      <div className='mb-4'>
        <h2 className='text-base font-semibold'>{t('dashboard.repoStatusTitle')}</h2>
        <p className='text-sm text-muted-foreground'>{t('dashboard.repoStatusSubtitle')}</p>
      </div>

      {loading && <HeroSkeleton />}

      {!loading && repos === null && (
        <p className='text-sm text-muted-foreground'>{t('dashboard.repoStatusUnavailable')}</p>
      )}

      {!loading && repos !== null && repos.length === 0 && (
        <div className='flex flex-col items-center gap-2 py-8 text-center'>
          <Inbox className='h-6 w-6 text-muted-foreground' aria-hidden='true' />
          <p className='text-sm font-medium'>{t('dashboard.noReposConnected')}</p>
        </div>
      )}

      {!loading && repos !== null && repos.length > 0 && (
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
          {repos.map(repo => <RepoTile key={repo.repositoryId} repo={repo} />)}
        </div>
      )}
    </motion.section>
  )
}

/** Shared entrance spring for dashboard cards (Apple Design §4 — critically damped, staggered by index). */
function DashboardCard ({ index, className, children }: { index: number, className?: string, children: React.ReactNode }): React.ReactElement {
  const reducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...(reducedMotion ? reducedMotionTransition : springSnappy), delay: reducedMotion ? 0 : index * 0.05 }}
      className={className}
    >
      <Card className='dashboard-card h-full'>
        {children}
      </Card>
    </motion.div>
  )
}

/** Skeleton for a single dashboard card. */
function DashboardCardSkeleton ({ className }: { className?: string }): React.ReactElement {
  return (
    <Card className={`h-full ${className ?? ''}`} aria-hidden='true'>
      <CardHeader className='flex flex-row items-center justify-between pb-2'>
        <Skeleton className='h-4 w-28' />
        <Skeleton className='h-4 w-4 rounded-full' />
      </CardHeader>
      <CardContent>
        <Skeleton className='mb-4 h-8 w-16' />
        <div className='grid grid-cols-2 gap-2'>
          <Skeleton className='h-12 rounded-lg' />
          <Skeleton className='h-12 rounded-lg' />
        </div>
      </CardContent>
    </Card>
  )
}

function SectionCards ({ data, loading }: { data: DashboardData | null, loading: boolean }): React.ReactElement | null {
  const { t } = useTranslation()

  if (loading || data === null) {
    return (
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4' aria-label='Loading dashboard'>
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
        <DashboardCardSkeleton />
      </div>
    )
  }

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
      <DashboardCard index={0}>
        <CardHeader className='flex flex-row items-center justify-between pb-2'>
          <CardDescription>{t('dashboard.scansOverview')}</CardDescription>
          <Activity className='h-4 w-4 text-muted-foreground' aria-hidden='true' />
        </CardHeader>
        <CardContent>
          <CardTitle className='text-3xl font-bold'>{data.scanStats.total}</CardTitle>
          <p className='text-xs text-muted-foreground'>
            {data.scanStats.successRate === null ? t('dashboard.noScansYet') : t('dashboard.successRate', { rate: data.scanStats.successRate })}
          </p>
        </CardContent>
      </DashboardCard>

      <DashboardCard index={1}>
        <CardHeader className='flex flex-row items-center justify-between pb-2'>
          <CardDescription>{t('dashboard.repositories')}</CardDescription>
          <GitBranch className='h-4 w-4 text-muted-foreground' aria-hidden='true' />
        </CardHeader>
        <CardContent>
          <CardTitle className='text-3xl font-bold'>{data.repoStats.total}</CardTitle>
          <p className='text-xs text-muted-foreground'>{t('dashboard.connected')}</p>
        </CardContent>
      </DashboardCard>

      {import.meta.env.VITE_TITVO_LAB !== 'true' && (
        <DashboardCard index={2}>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardDescription>{t('dashboard.apiKeysLabel')}</CardDescription>
            <KeyRound className='h-4 w-4 text-muted-foreground' aria-hidden='true' />
          </CardHeader>
          <CardContent>
            <CardTitle className='text-3xl font-bold'>{data.keyStats.active + data.keyStats.revoked}</CardTitle>
            <p className='text-xs text-muted-foreground'>{t('dashboard.active')} {data.keyStats.active}</p>
          </CardContent>
        </DashboardCard>
      )}

      {import.meta.env.VITE_TITVO_LAB !== 'true' && (
        <DashboardCard index={3}>
          <CardHeader className='flex flex-row items-center justify-between pb-2'>
            <CardDescription>{t('dashboard.usersLabel')}</CardDescription>
            <Users className='h-4 w-4 text-muted-foreground' aria-hidden='true' />
          </CardHeader>
          <CardContent>
            <CardTitle className='text-3xl font-bold'>{data.userStats.admin + data.userStats.member}</CardTitle>
            <p className='text-xs text-muted-foreground'>{t('dashboard.admins')} {data.userStats.admin}</p>
          </CardContent>
        </DashboardCard>
      )}
    </div>
  )
}

function ScansOverviewCard ({ stats, trend, index }: { stats: ScanStats, trend: DayBucket[], index: number }): React.ReactElement {
  const { t } = useTranslation()
  const showTrend = hasMeaningfulTrend(trend)

  return (
    <DashboardCard index={index} className='lg:col-span-2'>
      <CardHeader className='flex flex-row items-start justify-between pb-2'>
        <div className='space-y-1'>
          <CardDescription>{t('dashboard.scansOverview')}</CardDescription>
          <CardTitle className='text-3xl font-bold'>{stats.total}</CardTitle>
          <p className='text-sm text-muted-foreground'>
            {stats.successRate === null ? t('dashboard.noScansYet') : t('dashboard.successRate', { rate: stats.successRate })}
          </p>
        </div>
        {showTrend && <Sparkline data={trend} ariaLabel='Scan volume over the last 7 days' />}
      </CardHeader>
      <CardContent>
        <div className='grid grid-cols-2 gap-2'>
          <StatTile label={t('dashboard.inProgress')} value={stats.inProgress} tone='primary' />
          <StatTile label={t('dashboard.failed')} value={stats.failed} tone='danger' />
        </div>
      </CardContent>
    </DashboardCard>
  )
}

function LatestScanCard ({ latest, index }: { latest: RepoScanEntry | null, index: number }): React.ReactElement {
  const { t } = useTranslation()

  return (
    <DashboardCard index={index}>
      <CardHeader className='pb-2'>
        <CardDescription>{t('dashboard.latestScan')}</CardDescription>
      </CardHeader>
      <CardContent>
        {latest === null && (
          <div className='flex flex-col items-center justify-center gap-2 py-4 text-center'>
            <Inbox className='h-5 w-5 text-muted-foreground' aria-hidden='true' />
            <p className='text-sm text-muted-foreground'>{t('dashboard.noScansRecorded')}</p>
          </div>
        )}
        {latest !== null && (
          <div className='flex flex-col gap-2'>
            <span className='truncate text-sm font-medium'>{repoDisplayName(latest.repo)}</span>
            <Badge variant={scanStatusBadgeVariant(scanStatusTone(latest.scan.status, latest.scan.executionStatus))} className='w-fit'>
              {scanStatusLabel(latest.scan.status, latest.scan.executionStatus)}
            </Badge>
            <Link to={`/scans/${encodeURIComponent(latest.scan.scanId)}`} className='mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline'>
              {t('dashboard.view')} <ChevronRight className='h-3.5 w-3.5' aria-hidden='true' />
            </Link>
          </div>
        )}
      </CardContent>
    </DashboardCard>
  )
}

/**
 * Authenticated landing screen in the shadcn dashboard-01 style:
 * a row of summary section cards, a scans overview + latest-scan row,
 * and a repository-status mosaic below. All data comes from the existing
 * typed API clients — see `loadDashboardData` above.
 */
export function DashboardPage (): React.ReactElement {
  const { t } = useTranslation()
  const [state, setState] = useState<'loading' | 'error' | DashboardData>('loading')

  useEffect(() => {
    let cancelled = false
    loadDashboardData()
      .then(data => { if (!cancelled) setState(data) })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [])

  const data = typeof state === 'object' ? state : null

  return (
    <AppShell>
      <div className='flex flex-col gap-6'>
        {state === 'error' && (
          <Alert variant='destructive'>
            <AlertDescription>{t('dashboard.couldNotLoad')}</AlertDescription>
          </Alert>
        )}

        <SectionCards data={data} loading={state === 'loading'} />

        {data !== null && (
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
            <ScansOverviewCard stats={data.scanStats} trend={data.trendBuckets} index={4} />
            <LatestScanCard latest={data.latest} index={5} />
          </div>
        )}

        <RepoStatusHero repos={data?.repos ?? null} loading={state === 'loading'} />
      </div>
    </AppShell>
  )
}

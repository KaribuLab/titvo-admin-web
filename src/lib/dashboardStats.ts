import type { RepoListItem } from '../api/repos'
import type { ScanSummary } from '../api/scans'
import type { ApiKeyListItem } from '../api/apiKeys'
import type { UserListItem } from '../api/users'
import { scanStatusTone } from './scanStatus'

/**
 * Pure aggregation/derivation helpers behind the Dashboard's hero panel and
 * stat cards (see `src/pages/DashboardPage.tsx`). None of these fetch or
 * fabricate data — every input here already came from the existing typed
 * API clients (`listRepos`/`listScansForRepo`/`listApiKeys`/`listUsers`).
 */

export interface ScanStats {
  total: number
  success: number
  inProgress: number
  failed: number
  /** 0-100, rounded. `null` (never `NaN`) when there are zero scans to rate. */
  successRate: number | null
}

/** Reuses `scanStatusTone` (the same status→tone mapping the badges use) as the single source of truth, instead of re-hardcoding raw status strings here. */
export function aggregateScanStats (scans: ScanSummary[]): ScanStats {
  let success = 0
  let inProgress = 0
  let failed = 0

  for (const scan of scans) {
    const tone = scanStatusTone(scan.status, scan.executionStatus)
    if (tone === 'success') success++
    else if (tone === 'in-progress') inProgress++
    else if (tone === 'failed') failed++
  }

  const total = scans.length
  return {
    total,
    success,
    inProgress,
    failed,
    successRate: total === 0 ? null : Math.round((success / total) * 100)
  }
}

export interface RepoScanEntry {
  repo: RepoListItem
  scan: ScanSummary
}

/**
 * Picks the single most-recently-created scan across every repo's full scan
 * history. A scan with a missing/unparseable `createdAt` is never preferred
 * over one that has a usable timestamp; if none of the candidates have one,
 * the first entry is returned as a stable, deterministic fallback rather
 * than an arbitrary pick.
 */
export function pickLatestScan (entries: RepoScanEntry[]): RepoScanEntry | null {
  let best: RepoScanEntry | null = null
  let bestTime = -Infinity

  for (const entry of entries) {
    const parsed = entry.scan.createdAt !== undefined ? Date.parse(entry.scan.createdAt) : NaN
    const comparable = Number.isNaN(parsed) ? -Infinity : parsed
    if (best === null || comparable > bestTime) {
      best = entry
      bestTime = comparable
    }
  }

  return best
}

export interface RepoStats {
  total: number
  scanned: number
  neverScanned: number
}

/** A repo counts as "scanned" by its actually-fetched scan history (`scansByRepo`), not just the `lastScan` embed — the Dashboard already fetches full history per repo for the scans-overview card, so this reuses that same data instead of a second source of truth. */
export function computeRepoStats (repos: RepoListItem[], scansByRepo: Record<string, ScanSummary[]>): RepoStats {
  const total = repos.length
  const scanned = repos.filter(repo => (scansByRepo[repo.repositoryId]?.length ?? 0) > 0).length
  return { total, scanned, neverScanned: total - scanned }
}

export interface DayBucket {
  dateKey: string
  count: number
}

function toDateKey (date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Buckets real scans by their UTC created-date over the last `days` days
 * (inclusive of `now`'s day), filling in zero-count days so the resulting
 * series has no gaps. Scans with a missing/unparseable `createdAt` are
 * excluded from bucketing (there is no honest day to place them on) rather
 * than silently miscounted into an arbitrary bucket.
 */
export function bucketScansByDay (scans: ScanSummary[], days: number, now: Date = new Date()): DayBucket[] {
  const counts = new Map<string, number>()

  for (const scan of scans) {
    if (scan.createdAt === undefined) continue
    const parsed = Date.parse(scan.createdAt)
    if (Number.isNaN(parsed)) continue
    const key = toDateKey(new Date(parsed))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const buckets: DayBucket[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now)
    day.setUTCDate(day.getUTCDate() - i)
    const key = toDateKey(day)
    buckets.push({ dateKey: key, count: counts.get(key) ?? 0 })
  }
  return buckets
}

/**
 * Whether a bucketed series is worth rendering as a sparkline. Deliberately
 * conservative — a single busy day (e.g. all seed data created in one
 * batch) is real data but not a meaningful *trend*, so it renders as a
 * plain number instead of a fabricated-looking flat/spiky line.
 */
export function hasMeaningfulTrend (buckets: DayBucket[]): boolean {
  return buckets.filter(bucket => bucket.count > 0).length >= 2
}

export interface KeyStats {
  active: number
  revoked: number
}

export function computeKeyStats (keys: ApiKeyListItem[]): KeyStats {
  return {
    active: keys.filter(key => key.status === 'active').length,
    revoked: keys.filter(key => key.status === 'revoked').length
  }
}

export interface UserStats {
  admin: number
  member: number
}

export function computeUserStats (users: UserListItem[]): UserStats {
  return {
    admin: users.filter(user => user.role === 'admin').length,
    member: users.filter(user => user.role === 'member').length
  }
}

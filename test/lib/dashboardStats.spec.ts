import { describe, it, expect } from 'vitest'
import {
  aggregateScanStats,
  pickLatestScan,
  computeRepoStats,
  bucketScansByDay,
  hasMeaningfulTrend,
  computeKeyStats,
  computeUserStats
} from '../../src/lib/dashboardStats'

describe('aggregateScanStats', () => {
  it('counts success/in-progress/failed via the shared scan status tone mapping and computes a rounded success rate', () => {
    const stats = aggregateScanStats([
      { scanId: '1', status: 'SUCCESS' },
      { scanId: '2', status: 'SUCCESS' },
      { scanId: '3', status: 'IN_PROGRESS' },
      { scanId: '4', status: 'FAILED' },
      { scanId: '5', status: 'TIMEOUT' }
    ])
    expect(stats.total).toBe(5)
    expect(stats.success).toBe(2)
    expect(stats.inProgress).toBe(1)
    expect(stats.failed).toBe(1)
    expect(stats.successRate).toBe(40)
  })

  it('returns a null success rate (not NaN/Infinity) when there are zero scans, so the UI can render an honest empty state', () => {
    expect(aggregateScanStats([]).successRate).toBeNull()
    expect(aggregateScanStats([]).total).toBe(0)
  })
})

describe('pickLatestScan', () => {
  it('picks the most recently created scan across every repo', () => {
    const repoA = { repositoryId: 'a', lastScan: null }
    const repoB = { repositoryId: 'b', lastScan: null }
    const result = pickLatestScan([
      { repo: repoA, scan: { scanId: 's1', status: 'SUCCESS', createdAt: '2026-01-01T00:00:00Z' } },
      { repo: repoB, scan: { scanId: 's2', status: 'FAILED', createdAt: '2026-01-03T00:00:00Z' } }
    ])
    expect(result?.scan.scanId).toBe('s2')
    expect(result?.repo.repositoryId).toBe('b')
  })

  it('returns null when there are no scans anywhere (spec: no scans empty state)', () => {
    expect(pickLatestScan([])).toBeNull()
  })

  it('never throws on a scan with a missing createdAt, still returning a stable result', () => {
    const repoA = { repositoryId: 'a', lastScan: null }
    const result = pickLatestScan([{ repo: repoA, scan: { scanId: 's1', status: 'SUCCESS' } }])
    expect(result?.scan.scanId).toBe('s1')
  })
})

describe('computeRepoStats', () => {
  it('splits repos into scanned vs never-scanned using their real fetched scan history', () => {
    const repos = [{ repositoryId: 'a', lastScan: null }, { repositoryId: 'b', lastScan: null }]
    const stats = computeRepoStats(repos, { a: [{ scanId: 's1', status: 'SUCCESS' }], b: [] })
    expect(stats).toEqual({ total: 2, scanned: 1, neverScanned: 1 })
  })
})

describe('bucketScansByDay / hasMeaningfulTrend', () => {
  it('buckets scans by their created date (UTC), filling zero-count days for the requested window', () => {
    const now = new Date('2026-01-05T12:00:00Z')
    const buckets = bucketScansByDay([
      { scanId: '1', status: 'SUCCESS', createdAt: '2026-01-05T01:00:00Z' },
      { scanId: '2', status: 'SUCCESS', createdAt: '2026-01-03T01:00:00Z' }
    ], 3, now)
    expect(buckets).toHaveLength(3)
    expect(buckets[buckets.length - 1]).toEqual({ dateKey: '2026-01-05', count: 1 })
  })

  it('excludes scans with a missing/unparseable createdAt instead of throwing or miscounting', () => {
    const now = new Date('2026-01-05T12:00:00Z')
    const buckets = bucketScansByDay([
      { scanId: '1', status: 'SUCCESS' },
      { scanId: '2', status: 'SUCCESS', createdAt: 'not-a-date' }
    ], 3, now)
    expect(buckets.reduce((sum, b) => sum + b.count, 0)).toBe(0)
  })

  it('reports no meaningful trend when every scan lands on the same single day (honest — never fabricates a line)', () => {
    const buckets = [{ dateKey: 'd1', count: 0 }, { dateKey: 'd2', count: 3 }, { dateKey: 'd3', count: 0 }]
    expect(hasMeaningfulTrend(buckets)).toBe(false)
  })

  it('reports a meaningful trend once at least two distinct days have real activity', () => {
    const buckets = [{ dateKey: 'd1', count: 1 }, { dateKey: 'd2', count: 3 }, { dateKey: 'd3', count: 0 }]
    expect(hasMeaningfulTrend(buckets)).toBe(true)
  })
})

describe('computeKeyStats / computeUserStats', () => {
  it('counts active vs revoked API keys', () => {
    expect(computeKeyStats([
      { keyId: '1', label: 'a', status: 'active' },
      { keyId: '2', label: 'b', status: 'revoked' },
      { keyId: '3', label: 'c', status: 'active' }
    ])).toEqual({ active: 2, revoked: 1 })
  })

  it('counts admin vs member users', () => {
    expect(computeUserStats([
      { userId: '1', email: 'a@b.com', role: 'admin', status: 'active' },
      { userId: '2', email: 'c@d.com', role: 'member', status: 'active' }
    ])).toEqual({ admin: 1, member: 1 })
  })
})

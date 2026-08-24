import { apiFetch } from './client'
import { ScanSummary, toScanSummary } from './scans'

/**
 * Wire-ready list item for `GET /api/admin/repos`. `lastScan: null` covers
 * BOTH "never scanned" and "the repository_id GSI backfill window hasn't
 * completed yet" — the BFF deliberately makes these indistinguishable at
 * the wire level (see `ListReposUseCase`), so there is no separate
 * "temporarily unavailable" signal to detect here. Both are legitimate,
 * non-error states per spec (Repo never scanned / Orphan Data Resilience).
 */
export interface RepoListItem {
  repositoryId: string
  name?: string
  url?: string
  provider?: string
  lastScan: ScanSummary | null
}

interface RepoListResponse {
  items: Array<{
    repository_id: string
    name?: string
    url?: string
    provider?: string
    last_scan: Parameters<typeof toScanSummary>[0] | null
  }>
}

function toRepoListItem (wire: RepoListResponse['items'][number]): RepoListItem {
  return {
    repositoryId: wire.repository_id,
    name: wire.name,
    url: wire.url,
    provider: wire.provider,
    lastScan: wire.last_scan === null ? null : toScanSummary(wire.last_scan)
  }
}

/**
 * `GET /api/admin/repos` — no repos connected ⇒ `{items:[]}`, an explicit
 * empty state, never an error (spec: No repos connected). Every field
 * besides `repositoryId` is optional (design risk resolution #3 — the
 * `repository` table's only writer, `@titvo/trigger`, is not vendored
 * here, so its exact shape cannot be verified from this checkout).
 */
export async function listRepos (): Promise<RepoListItem[]> {
  const response = await apiFetch<RepoListResponse>('/api/admin/repos')
  return response.items.map(toRepoListItem)
}

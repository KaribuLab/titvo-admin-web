import { apiFetch } from './client'

/** Backs both the repo-scoped scan list and the `lastScan` embed on `listRepos()`. */
export interface ScanSummary {
  scanId: string
  status: string
  source?: string
  branch?: string
  createdAt?: string
  updatedAt?: string
}

export interface ScanDetail extends ScanSummary {
  repositoryId: string
  args?: unknown
  result?: unknown
}

interface ScanSummaryWire {
  scan_id: string
  status: string
  source?: string
  branch?: string
  created_at?: string
  updated_at?: string
}

interface ScanDetailWire extends ScanSummaryWire {
  repository_id: string
  args?: unknown
  result?: unknown
}

interface ScanListResponse {
  items: ScanSummaryWire[]
}

export function toScanSummary (wire: ScanSummaryWire): ScanSummary {
  return {
    scanId: wire.scan_id,
    status: wire.status,
    source: wire.source,
    branch: wire.branch,
    createdAt: wire.created_at,
    updatedAt: wire.updated_at
  }
}

function toScanDetail (wire: ScanDetailWire): ScanDetail {
  return {
    ...toScanSummary(wire),
    repositoryId: wire.repository_id,
    args: wire.args,
    result: wire.result
  }
}

/**
 * `GET /api/admin/repos/:id/scans` — newest first, as returned by the BFF.
 * An unknown or orphan repository id renders `{items:[]}`, never an error
 * (spec: Orphan Data Resilience — the BFF already normalizes this; see
 * `scans.handler.ts`).
 */
export async function listScansForRepo (repositoryId: string): Promise<ScanSummary[]> {
  const response = await apiFetch<ScanListResponse>(`/api/admin/repos/${encodeURIComponent(repositoryId)}/scans`)
  return response.items.map(toScanSummary)
}

/** `GET /api/admin/scans/:id` — throws a 404 `not_found` `ApiError` when the scan does not exist. */
export async function getScan (scanId: string): Promise<ScanDetail> {
  const response = await apiFetch<ScanDetailWire>(`/api/admin/scans/${encodeURIComponent(scanId)}`)
  return toScanDetail(response)
}

export interface TriggeredScan {
  scanId: string
  /**
   * Set when the BFF detected the scan almost certainly won't be linked to
   * this repo's existing scan history (the shared service key belongs to a
   * different user than whoever's key produced that history) — see
   * `RepoListPage`. The scan still ran; this is informational only.
   */
  warning?: string
}

interface TriggerScanResponse {
  scan_id: string
  warning?: string
}

export type ScanMode = 'commit' | 'full'

/**
 * `POST /api/admin/repos/:id/trigger-scan` — admin-only (BFF 403s a
 * member); GitHub and Bitbucket repos supported. Reuses the SAME production
 * `/run-scan` endpoint GitHub Actions/Bitbucket Pipelines already call, via
 * titvo-task-trigger-aws. A `422 config_missing` `ApiError` carries the
 * BFF's own `message` naming exactly which config parameter is unset
 * (e.g. `default_github_assignee`) — surface it verbatim, it is already
 * written to be actionable. `scanMode` is optional — omit it (or pass
 * `'commit'`) for the default incremental scan; pass `'full'` for a full
 * scan (mirrors titvo-task-trigger-aws's own `scan_mode` contract).
 */
export async function triggerScan (repositoryId: string, branch: string, scanMode?: ScanMode): Promise<TriggeredScan> {
  const response = await apiFetch<TriggerScanResponse>(`/api/admin/repos/${encodeURIComponent(repositoryId)}/trigger-scan`, {
    method: 'POST',
    body: scanMode === undefined ? { branch } : { branch, scan_mode: scanMode }
  })
  return { scanId: response.scan_id, warning: response.warning }
}

interface DefaultBranchResponse {
  branch: string
}

/**
 * `GET /api/admin/repos/:id/default-branch` — admin-only. Auto-detects the
 * repo's actual default branch so the "Run scan" dialog can pre-fill
 * something better than a hardcoded `"main"` guess. Callers should treat a
 * failure here as non-fatal (fall back to `"main"`) — this is a nicety, not
 * a blocker for triggering a scan.
 */
export async function getDefaultBranch (repositoryId: string): Promise<string> {
  const response = await apiFetch<DefaultBranchResponse>(`/api/admin/repos/${encodeURIComponent(repositoryId)}/default-branch`)
  return response.branch
}

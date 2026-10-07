import i18n from '../i18n/config'
export type ScanStatusTone = 'success' | 'in-progress' | 'failed' | 'timeout' | 'neutral'

const TONE_BY_STATUS: Record<string, ScanStatusTone> = {
  SUCCESS: 'success',
  COMPLETED: 'success',
  INCOMPLETE: 'timeout',
  IN_PROGRESS: 'in-progress',
  FAILED: 'failed',
  TIMEOUT: 'timeout'
}

/**
 * Scan status is an open string owned by the scanning pipeline (see
 * `ScanStatus` in the BFF's `core/scan/scan.entity.ts` — this client never
 * validates, renames, or maps it to a fixed enum). Optional measured execution
 * takes precedence in the display without replacing the original status. Known values get a
 * distinct badge tone (spec: Scan Status Fidelity); anything else still
 * renders with its own raw text via `scanStatusLabel`, just with a neutral
 * tone, so an unrecognized future status never crashes or disappears.
 */
export function scanStatusTone (status: string, executionStatus?: string): ScanStatusTone {
  return TONE_BY_STATUS[executionStatus ?? status] ?? 'neutral'
}

/** Translate explicit execution; preserve raw evaluation when execution is unavailable. */
export function scanStatusLabel (status: string, executionStatus?: string): string {
  return executionStatus !== undefined ? i18n.t(`analysis.execution${executionStatus}`, { defaultValue: executionStatus.replace(/_/g, ' ') }) : status.replace(/_/g, ' ')
}

const ACCENT_VAR_BY_TONE: Record<ScanStatusTone, string> = {
  success: 'hsl(var(--success))',
  'in-progress': 'hsl(var(--primary))',
  failed: 'hsl(var(--destructive))',
  timeout: 'hsl(var(--warning))',
  neutral: 'hsl(var(--muted-foreground))'
}

/**
 * CSS custom-property reference for a status tone's accent color — reused
 * by the Dashboard's hero repo-status tiles so the tile accent and the
 * badge always agree, with exactly one place owning the mapping. References
 * the shadcn theme layer's HSL variables (`src/index.css`) rather than
 * `tokens.css`'s hex ones, so the accent stays correct in dark mode too
 * (`tokens.css` has no dark variant for these).
 */
export function scanStatusAccentVar (tone: ScanStatusTone): string {
  return ACCENT_VAR_BY_TONE[tone]
}

/** shadcn `Badge`'s `variant` prop for a given tone — reuses the SAME tone mapping above, no new status colors invented for the shadcn migration either. */
export type ScanStatusBadgeVariant = 'success' | 'default' | 'destructive' | 'warning' | 'secondary'

const BADGE_VARIANT_BY_TONE: Record<ScanStatusTone, ScanStatusBadgeVariant> = {
  success: 'success',
  'in-progress': 'default',
  failed: 'destructive',
  timeout: 'warning',
  neutral: 'secondary'
}

export function scanStatusBadgeVariant (tone: ScanStatusTone): ScanStatusBadgeVariant {
  return BADGE_VARIANT_BY_TONE[tone]
}

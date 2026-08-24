import React from 'react'
import { Progress } from './ui/progress'

export interface ComparisonBarProps {
  label: string
  primaryLabel: string
  primaryValue: number
  secondaryLabel: string
  secondaryValue: number
}

/**
 * A two-segment comparison of two real counts (e.g. active vs revoked API
 * keys) — proportion only, deliberately never a time axis, so it never
 * implies a trend that doesn't exist. Renders an even 50/50 split when both
 * values are zero, so it never divides by zero or disappears.
 *
 * Built on shadcn's own `Progress` (Radix) rather than two hand-styled
 * `<span>` segments: the filled indicator IS the primary segment, and the
 * track IS the secondary segment (they always sum to the full bar, so this
 * maps onto Progress's single-value model exactly — no information lost).
 * Radix's `Progress` already carries `role="progressbar"` +
 * `aria-valuenow`/`min`/`max`; the explicit `aria-label` below adds the
 * actual counts, which those numeric ARIA attributes don't spell out.
 */
export function ComparisonBar ({ label, primaryLabel, primaryValue, secondaryLabel, secondaryValue }: ComparisonBarProps): React.ReactElement {
  const total = primaryValue + secondaryValue
  const primaryPct = total === 0 ? 50 : (primaryValue / total) * 100

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <Progress
        value={primaryPct}
        aria-label={`${primaryLabel}: ${primaryValue}, ${secondaryLabel}: ${secondaryValue}`}
        className="bg-muted-foreground/20"
      />
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />{primaryLabel} {primaryValue}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />{secondaryLabel} {secondaryValue}
        </span>
      </div>
    </div>
  )
}

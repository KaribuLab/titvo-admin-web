import React from 'react'
import { cn } from '../lib/utils'
import { Card, CardContent } from './ui/card'

export type StatTileTone = 'default' | 'primary' | 'danger' | 'warning' | 'success'

export interface StatTileProps {
  label: string
  value: React.ReactNode
  tone?: StatTileTone
}

const TONE_CLASS: Record<StatTileTone, string> = {
  default: 'text-foreground',
  primary: 'text-primary',
  danger: 'text-destructive',
  warning: 'text-warning',
  success: 'text-success'
}

/** A small labeled sub-stat box used inside the Dashboard's stat cards (e.g. "In progress: 2") — a shadcn `Card`, same primitive as everything else, just nested and unshadowed so it reads as a sub-region of its parent card rather than a peer. */
export function StatTile ({ label, value, tone = 'default' }: StatTileProps): React.ReactElement {
  return (
    <Card className="bg-muted/50 shadow-none">
      <CardContent className="flex flex-col gap-0.5 px-3 py-2">
        <span className={cn('text-lg font-semibold leading-none', TONE_CLASS[tone])}>{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  )
}

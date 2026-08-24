import React from 'react'

export interface SparklinePoint {
  count: number
}

export interface SparklineProps {
  data: SparklinePoint[]
  width?: number
  height?: number
  ariaLabel: string
}

/**
 * A minimal presentational inline SVG line chart. Purely a rendering of
 * already-aggregated points — no bucketing, thresholding, or "is this
 * worth showing" decision happens here (see `hasMeaningfulTrend` in
 * `src/lib/dashboardStats.ts`, which the caller consults before rendering
 * this at all, so a sparse/flat series is never fabricated into a line).
 */
export function Sparkline ({ data, width = 160, height = 40, ariaLabel }: SparklineProps): React.ReactElement | null {
  if (data.length < 2) return null

  const max = Math.max(...data.map(point => point.count), 1)
  const stepX = width / (data.length - 1)
  const points = data
    .map((point, index) => {
      const x = index * stepX
      const y = height - (point.count / max) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
    >
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

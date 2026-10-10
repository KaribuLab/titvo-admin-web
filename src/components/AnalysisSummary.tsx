/** Ordered scan overview with searchable, expandable findings and recorded costs. */
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from './ui/card'

/** Narrow opaque BFF data before presenting user-facing facts. */
function record (value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']
const TONES: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-600 dark:text-red-300',
  HIGH: 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  MEDIUM: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  LOW: 'bg-primary/10 text-primary',
  INFO: 'bg-muted text-muted-foreground'
}

/** Show explicit unknown duration instead of estimating historical task timings. */
function duration (value: unknown, missing: string): string {
  return typeof value === 'number' ? `${Math.floor(value / 60)} min ${(value % 60).toFixed(1)} s` : missing
}

/** Rank by severity, then file and line, preserving every input finding. */
function compareIssues (a: Record<string, unknown>, b: Record<string, unknown>): number {
  const rank = (issue: Record<string, unknown>): number => {
    const index = SEVERITIES.indexOf(String(issue.severity))
    return index < 0 ? SEVERITIES.length : index
  }
  const severityDifference = rank(a) - rank(b)
  if (severityDifference !== 0) return severityDifference
  const pathDifference = String(a.path ?? '').localeCompare(String(b.path ?? ''))
  return pathDifference !== 0 ? pathDifference : Number(a.line ?? 0) - Number(b.line ?? 0)
}

/** Prioritize outcome and findings; put detailed telemetry behind a disclosure. */
export function AnalysisSummary ({ result }: { result: unknown }): React.ReactElement {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [severity, setSeverity] = useState('')
  const [page, setPage] = useState(0)
  const data = record(result)
  const usage = record(data.usage)
  const metrics = record(data.metrics)
  const coverage = record(data.coverage)
  const issues = Array.isArray(data.issues) ? data.issues.map(record).sort(compareIssues) : []
  const findingCount = Array.isArray(data.issues) ? issues.length : typeof data.issues_count === 'number' && Number.isFinite(data.issues_count) && data.issues_count >= 0 ? data.issues_count : undefined
  const reportUrl = typeof data.report_url === 'string' && /^https?:\/\//i.test(data.report_url) ? data.report_url : undefined
  const errors = [...new Set([...(typeof data.error === 'string' && data.error !== '' ? [data.error] : []), ...(Array.isArray(coverage.errors) ? coverage.errors.map(String) : [])])]
  const execution = coverage.complete === true ? 'COMPLETED' : coverage.complete === false ? (metrics.completed_batches === 0 && errors.length > 0 ? 'FAILED' : 'INCOMPLETE') : 'UNKNOWN'
  const missing = t('analysis.notRecorded')
  const cost = typeof usage.cost_usd === 'number' ? `US$ ${usage.cost_usd.toFixed(6)}` : missing
  const costStatus = usage.cost_status === 'partial' ? t('analysis.partial') : usage.cost_status === 'mock' ? t('analysis.mock') : t('analysis.estimated')
  const hero = [
    [t('analysis.totalDuration'), duration(metrics.task_duration_seconds, missing)],
    [t('analysis.cost'), cost],
    [t('analysis.files'), String(data.scaned_files ?? '—')],
    [t('analysis.findings'), findingCount === undefined ? missing : String(findingCount)]
  ]
  const facts = [
    [t('analysis.duration'), duration(metrics.duration_seconds, missing)],
    [t('analysis.model'), String(usage.model ?? data.model_mode ?? '—')],
    [t('analysis.batches'), `${String(metrics.completed_batches ?? '—')} / ${String(metrics.total_batches ?? '—')}`],
    [t('analysis.tokens'), typeof usage.measured_calls === 'number' && usage.measured_calls > 0 ? `${String(usage.input_tokens)} / ${String(usage.cached_input_tokens)} / ${String(usage.output_tokens)}` : missing],
    [t('analysis.calls'), String(usage.calls ?? '—')],
    [t('analysis.truncated'), String(Array.isArray(data.truncated_files) ? data.truncated_files.length : 0)],
    [t('analysis.excluded'), String(Array.isArray(data.excluded) ? data.excluded.length : 0)]
  ]
  const filtered = issues.filter(issue => (severity === '' || issue.severity === severity) && `${String(issue.title)} ${String(issue.path)} ${String(issue.description ?? '')}`.toLowerCase().includes(query.toLowerCase()))
  const lastPage = Math.max(0, Math.ceil(filtered.length / 20) - 1)
  const currentPage = Math.min(page, lastPage)
  const visible = filtered.slice(currentPage * 20, (currentPage + 1) * 20)

  return (
    <section className='space-y-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h2 className='text-lg font-semibold'>{t('analysis.title')}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${coverage.complete === true ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
          {t('analysis.coverage')} · {coverage.complete === true ? t('analysis.complete') : coverage.complete === false ? t('analysis.incomplete') : '—'}
        </span>
      </div>
      <div className='grid gap-3 sm:grid-cols-3'>
        <div className='rounded-lg border p-3'><p className='text-xs text-muted-foreground'>{t('analysis.execution')}</p><p className={`mt-1 font-medium ${execution === 'COMPLETED' ? 'text-emerald-700 dark:text-emerald-300' : execution === 'UNKNOWN' ? 'text-muted-foreground' : 'text-destructive'}`}>{t(`analysis.execution${execution}`)}</p></div>
        <div className='rounded-lg border p-3'><p className='text-xs text-muted-foreground'>{t('analysis.findings')}</p><p className='mt-1 font-medium'>{findingCount === undefined ? missing : findingCount > 0 ? `${t('analysis.withFindings')} · ${findingCount}` : t('analysis.withoutFindings')}</p></div>
        <div className='rounded-lg border p-3'><p className='text-xs text-muted-foreground'>{t('analysis.technicalErrors')}</p><p className={`mt-1 font-medium ${errors.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{errors.length > 0 ? t('analysis.hasErrors') : t('analysis.noErrors')}</p></div>
      </div>
      <div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
        {hero.map(([label, value]) => (
          <Card key={label} className='border-primary/10 bg-primary/5 shadow-none'>
            <CardContent className='p-4'><p className='text-xs text-muted-foreground'>{label}</p><p className='mt-2 break-words text-lg font-semibold tracking-tight'>{value}</p>{label === t('analysis.cost') && typeof usage.cost_usd === 'number' && <p className='mt-1 text-xs text-muted-foreground'>{costStatus}</p>}</CardContent>
          </Card>
        ))}
      </div>
      {data.model_mode === 'mock' && <p className='rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground'>{t('analysis.mockExplanation')}</p>}
      {typeof data.error === 'string' && <p role='alert' className='rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive'>{data.error}</p>}
      {typeof data.error !== 'string' && Array.isArray(coverage.errors) && coverage.errors.length > 0 && <ul className='space-y-1 text-sm text-destructive'>{coverage.errors.map((error, index) => <li key={index}>{String(error)}</li>)}</ul>}
      {usage.cost_status === 'partial' && <p className='text-sm text-destructive'>{t('analysis.partialExplanation')}</p>}
      <details className='rounded-xl border bg-muted/20 p-4'>
        <summary className='cursor-pointer text-sm font-medium'>{t('analysis.consumption')}</summary>
        <dl className='mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {facts.map(([label, value]) => <div key={label}><dt className='text-xs text-muted-foreground'>{label}</dt><dd className='mt-1 break-words text-sm font-medium'>{value}</dd></div>)}
        </dl>
        <p className='mt-4 text-xs text-muted-foreground'>{t('analysis.scope')}</p>
      </details>
      {reportUrl !== undefined && <a className='inline-flex rounded-lg border border-primary/30 px-4 py-2 text-sm font-medium text-primary' href={reportUrl} target='_blank' rel='noopener noreferrer'>{t('analysis.openReport', { defaultValue: 'Abrir reporte completo' })}</a>}
      <div className='space-y-4'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div><h2 className='text-lg font-semibold'>{t('analysis.findings')}</h2><p className='text-xs text-muted-foreground'>{t('analysis.ordered')}</p></div>
          <div className='flex flex-wrap gap-2'>
            {SEVERITIES.filter(level => issues.some(issue => issue.severity === level)).map(level => <span key={level} className={`rounded-full px-2.5 py-1 text-xs font-medium ${TONES[level]}`}>{level} · {issues.filter(issue => issue.severity === level).length}</span>)}
          </div>
        </div>
        {issues.length > 0 && (
          <div className='flex flex-wrap gap-3'>
            <input className='min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-sm' aria-label={t('analysis.search')} placeholder={t('analysis.search')} value={query} onChange={event => { setQuery(event.target.value); setPage(0) }} />
            <select className='rounded-lg border bg-background px-3 py-2 text-sm' aria-label={t('analysis.filterSeverity')} value={severity} onChange={event => { setSeverity(event.target.value); setPage(0) }}>
              <option value=''>{t('analysis.allSeverities')}</option>{SEVERITIES.map(level => <option key={level} value={level}>{level}</option>)}
            </select>
          </div>
        )}
        {visible.length === 0 && <p className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>{!Array.isArray(data.issues) ? missing : issues.length === 0 ? t('analysis.noFindings') : t('analysis.noMatches')}</p>}
        <div className='space-y-2'>
          {visible.map((issue, index) => (
            <details key={`${String(issue.path)}-${String(issue.line)}-${String(issue.title)}-${index}`} className='group rounded-xl border bg-card open:border-primary/30'>
              <summary className='flex cursor-pointer list-none items-start gap-3 p-4'>
                <span className='mt-0.5 text-sm text-muted-foreground transition-transform group-open:rotate-90' aria-hidden='true'>▸</span>
                <div className='min-w-0 flex-1'><span className='text-sm font-medium'>{String(issue.title ?? '')}</span><p className='mt-1 break-all font-mono text-xs text-muted-foreground'>{String(issue.path ?? '')}:{String(issue.line ?? '')}</p></div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${TONES[String(issue.severity)] ?? TONES.INFO}`}>{String(issue.severity ?? '')}</span>
              </summary>
              <div className='space-y-4 border-t p-4 text-sm sm:pl-10'>
                <p className='leading-relaxed'>{String(issue.description ?? issue.summary ?? '')}</p>
                <div><h3 className='mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>{t('analysis.evidence')}</h3><pre className='overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted p-4 font-mono text-xs leading-relaxed'>{String(issue.code ?? '')}</pre></div>
                <div className='rounded-lg bg-primary/5 p-4'><h3 className='mb-2 font-medium'>{t('analysis.recommendation')}</h3><p className='leading-relaxed'>{String(issue.recommendation ?? '')}</p></div>
              </div>
            </details>
          ))}
        </div>
        {filtered.length > 20 && <div className='flex items-center justify-between text-sm'><button className='rounded-md border px-3 py-2 disabled:opacity-40' disabled={currentPage === 0} onClick={() => { setPage(currentPage - 1) }}>{t('analysis.previous')}</button><span>{currentPage + 1} / {lastPage + 1}</span><button className='rounded-md border px-3 py-2 disabled:opacity-40' disabled={currentPage === lastPage} onClick={() => { setPage(currentPage + 1) }}>{t('analysis.next')}</button></div>}
      </div>
    </section>
  )
}

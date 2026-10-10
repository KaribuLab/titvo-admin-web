import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../src/i18n/config'
import { AnalysisSummary } from '../../src/components/AnalysisSummary'

describe('Analysis summary', () => {
  it.each([
    [{ status: 'FAILED', coverage: { complete: true }, issues: [{ title: 'Vulnerability' }] }, /^(Completed|Completado)$/, /With findings|Con hallazgos/, /No errors reported|Sin errores reportados/],
    [{ coverage: { complete: true }, issues: [] }, /^(Completed|Completado)$/, /^(No findings reported|Sin hallazgos reportados)$/, /No errors reported|Sin errores reportados/],
    [{ coverage: { complete: false }, metrics: { completed_batches: 3 }, error: 'Batch error', issues: [] }, /^(Incomplete|Incompleto)$/, /^(No findings reported|Sin hallazgos reportados)$/, /With technical errors|Con errores técnicos/],
    [{ coverage: { complete: false }, metrics: { completed_batches: 0 }, error: 'Snapshot error', issues: [] }, /^(Failed|Fallido)$/, /^(No findings reported|Sin hallazgos reportados)$/, /With technical errors|Con errores técnicos/],
    [{ coverage: { complete: true }, error: 'Recovered warning', issues: [] }, /^(Completed|Completado)$/, /^(No findings reported|Sin hallazgos reportados)$/, /With technical errors|Con errores técnicos/]
  ])('separates execution, findings and errors %#', (result, execution, findings, errors) => {
    render(<AnalysisSummary result={result} />)
    expect(screen.getByText(execution)).toBeInTheDocument()
    expect(screen.getByText(findings)).toBeInTheDocument()
    expect(screen.getByText(errors)).toBeInTheDocument()
  })
  it('uses the AWS count when findings are stored in the external report', () => {
    render(<AnalysisSummary result={{ issues_count: 3, report_url: 'https://reports.example/scan.html' }} />)
    expect(screen.getByText(/(With findings|Con hallazgos) · 3/)).toBeInTheDocument()
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://reports.example/scan.html')
    expect(screen.queryByText(/^(No findings reported|Sin hallazgos reportados)$/)).not.toBeInTheDocument()
  })
  it('rejects executable report URLs', () => {
    render(<AnalysisSummary result={{ report_url: 'javascript:alert(1)' }} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
  it('orders and preserves findings across search, severity and paging', () => {
    const issues = Array.from({ length: 22 }, (_, index) => ({ title: `Low ${index}`, severity: 'LOW', path: `src/${index}.py`, line: 1 }))
    render(<AnalysisSummary result={{ issues: [...issues, { title: 'Urgent', severity: 'CRITICAL', path: 'api.py', line: 4 }] }} />)
    const findings = (): Element[] => Array.from(document.querySelectorAll('details > summary')).filter(item => item.textContent?.includes(':') === true)
    expect(findings()[0]).toHaveTextContent('Urgent')
    expect(findings()).toHaveLength(20)
    expect(document.querySelector('details')?.open).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: /Next|Siguiente/ }))
    expect(findings()).toHaveLength(3)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'CRITICAL' } })
    expect(screen.getByText('Urgent')).toBeInTheDocument()
    expect(screen.queryByText('Low 1')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'absent' } })
    expect(screen.queryByText('Urgent')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    expect(screen.getByText('Urgent')).toBeInTheDocument()
  })

  it('shows recorded costs, cached tokens and escaped findings', () => {
    render(<AnalysisSummary result={{ model_mode: 'real', scaned_files: 4, coverage: { complete: true }, metrics: { duration_seconds: 61, task_duration_seconds: 64, completed_batches: 6, total_batches: 6 }, usage: { model: 'gpt-4.1-mini', cost_usd: 0.01234, cost_status: 'estimated', measured_calls: 7, input_tokens: 1000, cached_input_tokens: 500, output_tokens: 200, calls: 7 }, issues: [{ title: 'Unsafe input', code: '<script>unsafe()</script>', path: 'app.py', line: 3 }] }} />)
    expect(screen.getByText(/US\$ 0.012340/)).toBeInTheDocument()
    expect(screen.getByText('1000 / 500 / 200')).toBeInTheDocument()
    expect(screen.getByText('<script>unsafe()</script>')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
  })
  it('does not invent historical cost and identifies incomplete telemetry', () => {
    const { rerender } = render(<AnalysisSummary result={{}} />)
    expect(screen.queryByText(/US\$/)).not.toBeInTheDocument()
    rerender(<AnalysisSummary result={{ error: 'Snapshot integrity mismatch', usage: { cost_usd: 1, cost_status: 'partial' } }} />)
    expect(screen.getByText(/US\$ 1.000000/)).toBeInTheDocument()
    expect(screen.getByText(/^(partial|parcial)$/)).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Snapshot integrity mismatch')
  })
})

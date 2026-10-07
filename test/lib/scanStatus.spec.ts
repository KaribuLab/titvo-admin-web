import { describe, it, expect } from 'vitest'
import { scanStatusTone, scanStatusLabel, scanStatusBadgeVariant } from '../../src/lib/scanStatus'

describe('scanStatus', () => {
  it('uses measured execution while preserving raw evaluation when absent', () => {
    expect(scanStatusTone('FAILED', 'COMPLETED')).toBe('success')
    expect(scanStatusLabel('FAILED', 'COMPLETED')).toMatch(/Completed|Completado/)
    expect(scanStatusTone('FAILED', 'INCOMPLETE')).toBe('timeout')
    expect(scanStatusLabel('FAILED', 'INCOMPLETE')).toMatch(/Incomplete|Incompleto/)
    expect(scanStatusLabel('FAILED')).toBe('FAILED')
  })
  describe('scanStatusTone', () => {
    it('maps SUCCESS to the success tone', () => {
      expect(scanStatusTone('SUCCESS')).toBe('success')
    })

    it('maps IN_PROGRESS to a distinct in-progress tone (spec: Scan Status Fidelity)', () => {
      expect(scanStatusTone('IN_PROGRESS')).toBe('in-progress')
    })

    it('maps FAILED to a distinct failed tone (spec: Scan Status Fidelity)', () => {
      expect(scanStatusTone('FAILED')).toBe('failed')
    })

    it('maps TIMEOUT to a distinct timeout tone (spec: Scan Status Fidelity)', () => {
      expect(scanStatusTone('TIMEOUT')).toBe('timeout')
    })

    it('falls back to a neutral tone for an unrecognized status, without crashing', () => {
      expect(scanStatusTone('SOME_FUTURE_STATUS')).toBe('neutral')
    })
  })

  describe('scanStatusLabel', () => {
    it('never collapses an unrecognized status to "unknown" — it always renders the raw status text', () => {
      expect(scanStatusLabel('SOME_FUTURE_STATUS')).toContain('SOME FUTURE STATUS')
      expect(scanStatusLabel('SOME_FUTURE_STATUS').toLowerCase()).not.toBe('unknown')
    })

    it('replaces underscores with spaces for readability', () => {
      expect(scanStatusLabel('IN_PROGRESS')).toBe('IN PROGRESS')
    })
  })

  describe('scanStatusBadgeVariant', () => {
    it('maps the success tone to the success shadcn Badge variant', () => {
      expect(scanStatusBadgeVariant('success')).toBe('success')
    })

    it('maps the failed tone to the destructive shadcn Badge variant', () => {
      expect(scanStatusBadgeVariant('failed')).toBe('destructive')
    })

    it('maps the neutral tone to the secondary shadcn Badge variant', () => {
      expect(scanStatusBadgeVariant('neutral')).toBe('secondary')
    })
  })
})

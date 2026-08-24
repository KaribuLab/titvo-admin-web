import { describe, it, expect } from 'vitest'
import { initialsFromEmail } from '../../src/lib/initials'

describe('initialsFromEmail', () => {
  it('takes the first letter of two dot-separated local-part segments', () => {
    expect(initialsFromEmail('jane.doe@titvo.dev')).toBe('JD')
  })

  it('takes the first two letters of a single-segment local part', () => {
    expect(initialsFromEmail('admin@titvo.dev')).toBe('AD')
  })

  it('never throws on a malformed or empty email, falling back to a safe placeholder', () => {
    expect(initialsFromEmail('')).toBe('?')
  })
})

/**
 * Derives a 2-letter avatar initial from a user's email — there is no
 * profile-picture concept in this app (see `AppHeader`'s avatar). Prefers
 * splitting the local part on `.`/`_`/`-` (e.g. "jane.doe" → "JD"); falls
 * back to the first two characters of a single-segment local part, and
 * finally to a safe "?" placeholder rather than throwing on an empty or
 * malformed email.
 */
export function initialsFromEmail (email: string): string {
  const local = email.split('@')[0] ?? ''
  const segments = local.split(/[._-]+/).filter(Boolean)

  if (segments.length === 0) {
    const fallback = email.slice(0, 1).toUpperCase()
    return fallback !== '' ? fallback : '?'
  }

  if (segments.length === 1) {
    return segments[0].slice(0, 2).toUpperCase()
  }

  return (segments[0].slice(0, 1) + segments[1].slice(0, 1)).toUpperCase()
}

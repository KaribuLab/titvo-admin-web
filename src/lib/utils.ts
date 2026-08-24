import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * shadcn/ui's standard class-name helper: merges conditional class lists
 * (`clsx`) and resolves conflicting Tailwind utility classes so the last
 * one wins (`tailwind-merge`), e.g. `cn('p-2', condition && 'p-4')`.
 */
export function cn (...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

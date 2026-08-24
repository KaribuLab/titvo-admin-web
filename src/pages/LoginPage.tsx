import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../api/client'
import { Card, CardContent, CardHeader } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { reducedMotionTransition, springSmooth } from '../lib/motion'
import titvoLogo from '../assets/titvo-logo.png'
import type { TFunction } from 'i18next'

function validateEmail (value: string, t: TFunction): string | null {
  if (value.length === 0) return null
  return value.includes('@') ? null : t('login.invalidEmail')
}

/**
 * First impression of the admin console — kept calm and focused (Apple
 * Design §16: purpose, one clear job), no sidebar chrome, generous
 * whitespace, a single centered card.
 */
export function LoginPage (): React.ReactElement {
  const { status, login } = useAuth()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  const emailError = emailTouched ? validateEmail(email, t) : null

  async function handleSubmit (event: React.FormEvent): Promise<void> {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (submitError) {
      // Same body for unknown email and bad password (design.md API
      // contract) — the UI never distinguishes them either.
      if (submitError instanceof ApiError && submitError.status === 401) {
        setError(t('login.invalidCredentials'))
      } else {
        setError(t('common.somethingWentWrong'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <motion.div
        className="w-full max-w-sm"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={reducedMotion ? reducedMotionTransition : springSmooth}
      >
        <div className="mb-6 flex items-center justify-center">
          <img src={titvoLogo} alt="Titvo" className="h-10 w-auto object-contain" />
        </div>

        <Card>
          <CardHeader className="sr-only">
            <h2>{t('login.logIn')}</h2>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={event => { void handleSubmit(event) }} noValidate className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">{t('login.email')}</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  disabled={submitting}
                  required
                  autoComplete="email"
                  autoFocus
                  aria-invalid={emailError !== null}
                />
                {emailError !== null && <p className="text-xs text-destructive">{emailError}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">{t('login.password')}</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  disabled={submitting}
                  required
                  autoComplete="current-password"
                />
              </div>

              {error !== null && (
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting ? t('login.signingIn') : t('login.logIn')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

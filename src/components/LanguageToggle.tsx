import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui/button'
import { useLanguage } from './LanguageProvider'

/** EN/ES toggle button — lives in the sidebar footer next to `ThemeToggle`. Shows the language it will switch TO (matches the sun/moon convention). */
export function LanguageToggle (): React.ReactElement {
  const { language, toggleLanguage } = useLanguage()
  const { t } = useTranslation()
  const nextLabel = language === 'en' ? t('sidebar.switchToSpanish') : t('sidebar.switchToEnglish')

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 shrink-0 text-xs font-semibold"
      onClick={toggleLanguage}
      aria-label={nextLabel}
      title={nextLabel}
    >
      {language === 'en' ? 'ES' : 'EN'}
    </Button>
  )
}

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from './en'
import { es } from './es'
import { resolveInitialLanguage } from '../lib/language'

// Initialized once, as a module-level side effect (imported by `main.tsx`
// before `App` renders) — `react-i18next`'s `useTranslation()` attaches to
// this default global instance, so no wrapping `I18nextProvider` is
// required; `LanguageProvider` only needs to call `i18n.changeLanguage()`
// and persist the choice, matching `ThemeProvider`'s existing shape.
void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es }
    },
    lng: resolveInitialLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes — avoids double-escaping interpolated values.
    },
    // No suspense — every page already has its own loading state; the
    // in-memory resources above are available synchronously anyway (no
    // network fetch to wait on).
    react: {
      useSuspense: false
    }
  })

export default i18n

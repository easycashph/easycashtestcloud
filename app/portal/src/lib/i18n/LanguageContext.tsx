import * as React from 'react';
import { en, fil, type Translations } from '@/lib/i18n/translations';

export type Locale = 'en' | 'fil';

const LANGUAGE_STORAGE_KEY = 'easycash-portal-language';
const DICTIONARIES: Record<Locale, Translations> = { en, fil };

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** The active dictionary. Access as `t.landing.heroTitle`, not a string-key lookup - see
   * translations.ts for why. */
  t: Translations;
}

const LanguageContext = React.createContext<LanguageContextValue | null>(null);

function getInitialLocale(): Locale {
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  return stored === 'fil' ? 'fil' : 'en';
}

/**
 * Provides the active language and dictionary to the public marketing/trust pages.
 *
 * Persisted to localStorage, mirroring `ThemeToggle`'s pattern
 * (`easycash-portal-theme` -> `easycash-portal-language`). Defaults to English rather than reading
 * `navigator.language`: an auto-detected switch to Filipino on first visit would be surprising for
 * a financial site, and English is the language every page (including the untranslated legal
 * pages and the application form) is written in by default - starting there avoids a jarring
 * language flip mid-flow for a first-time visitor.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(getInitialLocale);

  const setLocale = React.useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  }, []);

  const value = React.useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t: DICTIONARIES[locale] }),
    [locale, setLocale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Throws outside a LanguageProvider rather than silently falling back to English - a page that
 * uses this without the provider mounted is a wiring bug, not a runtime edge case to paper over. */
export function useLanguage(): LanguageContextValue {
  const ctx = React.useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}

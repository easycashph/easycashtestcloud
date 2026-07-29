import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * EN/FIL switch for the pages covered by the translation dictionary (see translations.ts for
 * exactly which pages that is). Styled to sit next to ThemeToggle in the nav.
 */
export function LanguageToggle() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      role="group"
      aria-label={t.nav.language}
      className="flex h-9 items-center rounded-full border border-border p-0.5 text-xs font-semibold"
    >
      {(['en', 'fil'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          aria-pressed={locale === option}
          className={`rounded-full px-2.5 py-1 transition-colors ${
            locale === option
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {option === 'en' ? 'EN' : 'FIL'}
        </button>
      ))}
    </div>
  );
}

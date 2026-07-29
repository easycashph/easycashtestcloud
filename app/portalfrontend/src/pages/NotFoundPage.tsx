import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * 404 page.
 *
 * Replaces a silent `<Navigate to="/" />` catch-all. Redirecting an unknown URL to the homepage
 * leaves the visitor wondering whether they mistyped, whether the page moved, or whether the site
 * is broken — and it hides broken links from us entirely. Saying so plainly, then offering the
 * routes people actually want, is both kinder and more useful.
 *
 * 2026-07-29: wired to the i18n system (was hardcoded English despite translations.ts already
 * having a full `notFound` namespace).
 */
export function NotFoundPage() {
  const { t } = useLanguage();

  const suggestedLinks = [
    { to: '/', label: t.notFound.linkHome },
    { to: '/requirements', label: t.notFound.linkRequirements },
    { to: '/news', label: t.notFound.linkNews },
    { to: '/security-tips', label: t.notFound.linkSecurity },
    { to: '/contact', label: t.notFound.linkContact },
  ];

  return (
    <PublicPageLayout title={t.notFound.title} intro={t.notFound.intro}>
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-sm font-semibold">{t.notFound.whereHeading}</h2>
        <ul className="mt-3 space-y-2">
          {suggestedLinks.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className="text-sm font-medium text-primary hover:underline">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link to="/" className="mt-5 inline-block">
          <Button size="sm">{t.notFound.backToHome}</Button>
        </Link>
      </div>
    </PublicPageLayout>
  );
}

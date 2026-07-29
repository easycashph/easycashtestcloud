import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';
import { useLanguage } from '@/lib/i18n/LanguageContext';
import { usePageMeta } from '@/lib/usePageMeta';

/**
 * Shell for standalone public content pages (anti-scam, complaints, privacy, terms).
 *
 * Guarantees every such page carries the regulatory footer - a visitor can land directly on any of
 * these routes from a search result or a shared link, so the disclosure cannot live on the landing
 * page alone. See SiteFooter for the legal basis.
 *
 * The "Back to home" link is translated even on pages whose own content isn't (Privacy, Terms) -
 * it's navigation chrome, not the document itself. See SiteFooter's doc comment for the same
 * reasoning.
 */
export function PublicPageLayout({
  title,
  intro,
  metaDescription,
  children,
}: {
  title: string;
  intro?: string;
  /** Overrides the site-wide meta description for this page. Defaults to `intro` when present. */
  metaDescription?: string;
  children: React.ReactNode;
}) {
  usePageMeta(title, metaDescription ?? intro);
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="container max-w-3xl flex-1 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t.common.backToHome}
        </Link>

        <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {intro && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{intro}</p>}

        <div className="mt-8">{children}</div>
      </main>

      <SiteFooter />
    </div>
  );
}

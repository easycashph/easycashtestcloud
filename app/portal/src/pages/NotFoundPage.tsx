import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { PublicPageLayout } from '@/components/PublicPageLayout';
import { Button } from '@/components/ui/Button';

/**
 * 404 page.
 *
 * Replaces a silent `<Navigate to="/" />` catch-all. Redirecting an unknown URL to the homepage
 * leaves the visitor wondering whether they mistyped, whether the page moved, or whether the site
 * is broken — and it hides broken links from us entirely. Saying so plainly, then offering the
 * routes people actually want, is both kinder and more useful.
 */
const SUGGESTED_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/requirements', label: 'Loan Requirements' },
  { to: '/news', label: 'News & Announcements' },
  { to: '/security-tips', label: 'Security & Anti-Scam' },
  { to: '/contact', label: 'Contact Us' },
];

export function NotFoundPage() {
  return (
    <PublicPageLayout
      title="Page not found"
      intro="The page you are looking for does not exist, or it may have been moved."
    >
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-sm font-semibold">Where would you like to go?</h2>
        <ul className="mt-3 space-y-2">
          {SUGGESTED_LINKS.map((link) => (
            <li key={link.to}>
              <Link to={link.to} className="text-sm font-medium text-primary hover:underline">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link to="/" className="mt-5 inline-block">
          <Button size="sm">Back to home</Button>
        </Link>
      </div>
    </PublicPageLayout>
  );
}

import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/**
 * Persistent bottom "Apply Now" bar, mobile only.
 *
 * Common pattern on Philippine digital lending sites (Tala, Cashalo, etc.) - once a visitor has
 * scrolled past the hero's own CTA, the primary action stays one thumb-reach away instead of
 * requiring a scroll back to the top. Appears once `sentinelRef` (rendered right after the hero)
 * scrolls out of view, via IntersectionObserver rather than a scroll-position calculation - cheaper
 * and doesn't need re-measuring on resize.
 */
export function MobileApplyBar({ sentinelRef }: { sentinelRef: React.RefObject<HTMLElement> }) {
  const { t } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting), {
      rootMargin: '0px',
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef]);

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur transition-transform duration-300 md:hidden ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
      // Hidden from screen readers while off-screen, and its own tabIndex below keeps it out of
      // the keyboard tab order too, so it never grabs focus before visible page content when
      // it's translated out of view.
      aria-hidden={!visible}
    >
      <Link to={isAuthenticated ? '/dashboard' : '/signup'} className="block" tabIndex={visible ? undefined : -1}>
        <Button className="w-full" size="lg">
          {isAuthenticated ? t.nav.goToDashboard : t.landing.applyToday}
        </Button>
      </Link>
    </div>
  );
}

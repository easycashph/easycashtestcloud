import * as React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, Menu, ShieldCheck, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NotificationBell } from '@/components/NotificationBell';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/lib/authContext';
import { usePortalDialogs } from '@/lib/portalDialogContext';
import { useLanguage } from '@/lib/i18n/LanguageContext';

/** Shared header for every logged-in page (Dashboard, My Profile, ...) - extracted so nav links
 * stay in one place as more authenticated pages get added. "Loan Products" tab removed 2026-07-27
 * (user request) - the /products page itself still exists, just no longer linked from the nav.
 *
 * 2026-07-31 (user request): "My Profile" and "Security" now open as a Dialog on top of the
 * current page (via PortalDialogHost) instead of navigating to a separate route.
 *
 * 2026-09-14 (semi-major portal redesign, user request: "persistent navbar ... must not disappear
 * or shift when navigating between pages"): now rendered exactly once by `PortalAppShell` (the
 * parent route element for every authenticated page), instead of separately by each page - a plain
 * React Router navigation between sibling routes no longer remounts it. Also gained the mobile nav
 * drawer it never had before (the desktop links were simply `hidden` below `sm:`, with nothing to
 * replace them - Dashboard/My Profile/Security were unreachable from a phone). */
export function PortalHeader() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const { openProfileDialog, openSecurityDialog } = usePortalDialogs();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isDashboard = location.pathname === '/dashboard';

  const navLinkClass = (active: boolean) =>
    `rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
      active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 shadow-sm backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-3">
        <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <img src="./logo-easycash.png" alt="Easycash" className="h-8 w-8 rounded-lg object-contain" />
          <span className="hidden text-base font-bold tracking-tight sm:inline">Easycash Portal</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          <Link to="/dashboard" className={navLinkClass(isDashboard)}>
            {t.portalHeader.dashboard}
          </Link>
          <button type="button" onClick={openProfileDialog} className={navLinkClass(false)}>
            {t.portalHeader.myProfile}
          </button>
          <button type="button" onClick={openSecurityDialog} className={navLinkClass(false)}>
            {t.portalHeader.security}
          </button>
        </nav>

        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 sm:flex">
            <ThemeToggle />
            <NotificationBell />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> {t.portalHeader.logOut}
            </Button>
          </div>

          {/* Mobile: bell stays visible at all times (a client should never miss a payment/status
              notification just because the drawer is closed); everything else moves into it. */}
          <div className="flex items-center gap-1 sm:hidden">
            <NotificationBell />
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-secondary"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-background px-4 pb-4 pt-2 sm:hidden">
          <nav className="flex flex-col gap-1">
            <Link
              to="/dashboard"
              onClick={() => setMenuOpen(false)}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium ${
                isDashboard ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-secondary'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" /> {t.portalHeader.dashboard}
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openProfileDialog();
              }}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-secondary"
            >
              <UserRound className="h-4 w-4" /> {t.portalHeader.myProfile}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                openSecurityDialog();
              }}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-secondary"
            >
              <ShieldCheck className="h-4 w-4" /> {t.portalHeader.security}
            </button>
          </nav>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> {t.portalHeader.logOut}
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}

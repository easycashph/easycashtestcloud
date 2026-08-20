import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
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
 * current page (via PortalDialogHost) instead of navigating to a separate route. */
export function PortalHeader() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { openProfileDialog, openSecurityDialog } = usePortalDialogs();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <img src="./logo-easycash.png" alt="Easycash" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-base font-bold tracking-tight">Easycash Portal</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
          <Link to="/dashboard" className="hover:text-foreground">
            {t.portalHeader.dashboard}
          </Link>
          <button type="button" onClick={openProfileDialog} className="hover:text-foreground">
            {t.portalHeader.myProfile}
          </button>
          <button type="button" onClick={openSecurityDialog} className="hover:text-foreground">
            {t.portalHeader.security}
          </button>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> {t.portalHeader.logOut}
          </Button>
        </div>
      </div>
    </header>
  );
}

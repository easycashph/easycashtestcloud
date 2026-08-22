import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Landmark,
  Wallet,
  Menu,
  Users,
  FileSpreadsheet,
  FileCheck2,
  BellRing,
  Settings,
  Info,
  SlidersHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  MessageCircle,
} from 'lucide-react';
import * as React from 'react';
import { AccountMenu } from '@/components/AccountMenu';
import { GlobalSearch } from '@/components/GlobalSearch';
import { HelpButton } from '@/components/HelpButton';
import { NotificationBell } from '@/components/NotificationBell';
import { SystemAnnouncementPopup } from '@/components/SystemAnnouncementPopup';
import { PreviewFooterNote } from '@/components/PreviewBanner';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/apiClient';
import { useRole } from '@/lib/roleContext';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/theme-provider';

/** 2026-07-31 (user request): a live count of unclaimed Portal chat requests, polled from the
 * sidebar so any eligible staff member sees a fresh "someone's waiting" indicator without opening
 * the Chat page - same 403-means-not-eligible handling as the page itself (silently shows 0 rather
 * than an error badge for a role that simply can't see the queue). */
function useChatQueueCount(): number {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    const poll = () => {
      apiClient
        .get<unknown[]>('/chat/queue')
        .then((queue) => {
          if (!cancelled) setCount(queue.length);
        })
        .catch(() => {
          if (!cancelled) setCount(0);
        });
    };
    poll();
    const timer = window.setInterval(poll, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  return count;
}

/**
 * Section/tab order confirmed by the business: Home → Loan → Collection → Configuration →
 * Administration (2026-07-08 - `Configuration` inserted before `Administration` as part of the
 * frontend↔backend wiring pilot's Stage 0c, see `docs/Architecture/
 * FRONTEND_BACKEND_WIRING_PILOT_DESIGN.md` §8.1; previous order, confirmed 2026-07-06, had no
 * `Configuration` group).
 */
const NAV_GROUPS = [
  {
    label: 'Home',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/reports', label: 'Reports', icon: FileSpreadsheet, end: false },
    ],
  },
  {
    label: 'Loan',
    items: [
      { to: '/applications', label: 'Loan Applications', icon: FileCheck2, end: false },
      { to: '/clients', label: 'Clients', icon: Users, end: false },
      { to: '/loans', label: 'Loan Accounts', icon: Landmark, end: false },
    ],
  },
  {
    label: 'Payments',
    items: [
      { to: '/payments', label: 'Record Payment', icon: Wallet, end: false },
      { to: '/reminders', label: 'Due & Overdue', icon: BellRing, end: false },
    ],
  },
  {
    label: 'Configuration',
    items: [{ to: '/configuration/settings', label: 'Settings', icon: Settings, end: false }],
  },
  {
    label: 'Administration',
    items: [{ to: '/admin/system', label: 'System', icon: SlidersHorizontal, end: false }],
  },
  {
    label: 'Support',
    items: [
      { to: '/chat', label: 'Chat', icon: MessageCircle, end: false },
      { to: '/support/about', label: 'About', icon: Info, end: false },
    ],
  },
];

/** 2026-08-06 (user-reported): a nav link to a page the signed-in role can't actually use (e.g.
 * Record Payment for a role without `payment.record`) shouldn't appear at all - same "hide, don't
 * just block after the click" fix already applied to the in-page actions this leads to. Keyed by
 * route path; a route with no entry here is visible to every role (unchanged default). */
const NAV_VISIBILITY: Partial<Record<string, (permissions: ReturnType<typeof useRole>) => boolean>> = {
  '/payments': (permissions) => permissions.canRecordPayment,
  // 2026-08-06 (user request): Administration > System is MIS-only, full stop - unlike every
  // other nav-visibility entry above, not tied to one configurable permission code, since the
  // whole System hub (Messaging & Alerts, User Accounts, Loan Products, Activity Logs) is itself
  // the screen MIS uses to configure everyone else's access.
  '/admin/system': (permissions) => permissions.currentAccount.roles.includes('MIS'),
};

function Sidebar({ open, collapsed }: { open: boolean; collapsed: boolean }) {
  const { theme, themeStyle } = useTheme();
  // Premium's light-mode sidebar uses the same navy background as regular dark mode (see
  // index.css's `[data-theme-style='premium']` block) - the colored logo's navy wordmark
  // disappears there too, so it needs the white logo just like dark mode does.
  const useWhiteLogo = theme === 'dark' || themeStyle === 'premium';
  const chatQueueCount = useChatQueueCount();
  const permissions = useRole();
  return (
    <div
      className={cn(
        // 2026-07-19: the sidebar and the main content column now each scroll independently (own
        // overflow-y-auto region, see AppLayout's root comment) instead of sharing one document
        // scroll - so this wrapper just needs to match the shell's full height (h-full, from the
        // parent's h-dvh/min-h-0 chain), not stretch/self-start tricks for a sticky child.
        'h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out lg:relative',
        collapsed ? 'lg:w-0' : 'lg:w-64',
      )}
    >
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:h-full lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* 2026-08-22 (user request): logo-only header - the old 36x36 box cropped the wide
            logo down to just its icon and repeated the company name in text beside it. Branch
            name dropped from here per that same request; still available elsewhere (e.g. the
            account menu). Logo choice needs JS (useWhiteLogo above), not a plain `dark:` variant -
            Premium's light-mode sidebar is navy too (same as dark mode), so the colored logo's
            navy wordmark would disappear there as well. Centered per follow-up request. */}
        <div className="flex min-h-16 shrink-0 items-center justify-center border-b border-sidebar-border px-5 py-3">
          {useWhiteLogo ? (
            <img src="/logo-easycash-white.png" alt="Easycash" className="h-6 w-auto object-contain" />
          ) : (
            <img src="/logo-easycash.png" alt="Easycash" className="h-8 w-auto object-contain" />
          )}
        </div>
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => (NAV_VISIBILITY[item.to] ?? (() => true))(permissions));
            if (visibleItems.length === 0) return null;
            return (
            <div key={group.label}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">{group.label}</p>
              <div className="flex flex-col gap-1">
                {visibleItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md border-l-2 px-[10px] py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'border-l-sidebar-accent bg-sidebar-accent/15 text-sidebar-accent'
                          : 'border-l-transparent text-sidebar-foreground/75 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground',
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                    {item.to === '/chat' && chatQueueCount > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                        {chatQueueCount}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}

/** Appearance now has exactly one control surface - Settings > Appearance (see SettingsPage) - the standalone toggle formerly here was removed 2026-07-08. */
function Topbar({
  onMenuClick,
  collapsed,
  onCollapseToggle,
}: {
  onMenuClick: () => void;
  collapsed: boolean;
  onCollapseToggle: () => void;
}) {
  // 2026-08-05 (user request): the global search box only makes sense on the Dashboard - every
  // other page removed it from the topbar entirely rather than just hiding it visually.
  const isDashboard = useLocation().pathname === '/';

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden rounded-full bg-muted/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:inline-flex"
          onClick={onCollapseToggle}
          aria-label={collapsed ? 'Show side menu' : 'Hide side menu'}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
        <div>
          <h1 className="text-sm font-semibold">Easycash Loan Management System Platform</h1>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {isDashboard && <GlobalSearch />}
        <HelpButton />
        <NotificationBell />
        <AccountMenu />
      </div>
    </header>
  );
}

const SIDEBAR_COLLAPSED_KEY_PREFIX = 'lms.sidebarCollapsed';

/** 2026-07-17: was a single shared key (`lms.sidebarCollapsed`) - one officer's collapse choice on
 * a shared machine silently applied to whoever logged in next. Suffixed per-user like every other
 * Settings > Appearance preference. `AppLayout` only ever renders inside the authenticated route
 * tree (see `App.tsx`'s doc comment - `RoleProvider` swaps in `LoginPage` for the entire tree
 * otherwise), and remounts fresh on every login/logout, so a plain per-user-keyed `useState`
 * initializer is enough here - no `loadPreferenceFor`-style live scope-switch needed, unlike
 * `theme-provider.tsx`'s prefs which stay mounted across that transition. */
function sidebarCollapsedKey(userId: string): string {
  return `${SIDEBAR_COLLAPSED_KEY_PREFIX}:${userId}`;
}

export function AppLayout() {
  const { currentAccount } = useRole();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(sidebarCollapsedKey(currentAccount.id)) === '1';
  });

  React.useEffect(() => {
    window.localStorage.setItem(sidebarCollapsedKey(currentAccount.id), collapsed ? '1' : '0');
  }, [collapsed, currentAccount.id]);

  // 2026-08-07 (user-reported): switching sidebar menus landed on whatever scroll position the
  // PREVIOUS page was left at, not the top of the new one. Root cause - <main> below (not
  // window/document) is the actual scroll container per this layout's own "sidebar and main
  // content scroll independently" design above, and React Router has no built-in scroll reset for
  // a custom scroll container (only for window scroll, which this app deliberately doesn't use).
  const mainRef = React.useRef<HTMLElement>(null);
  const location = useLocation();
  React.useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    // 2026-07-19 (user request): sidebar and main content must scroll independently of each other
    // - scrolling over the side menu should only move the side menu, scrolling over the center
    // content should only move the center content. That requires a viewport-height shell
    // (h-dvh + overflow-hidden here) with each of the two panes owning its own overflow-y-auto
    // region, rather than one shared document scroll.
    //
    // This intentionally reverts a prior document-scroll design (see git history) that was chosen
    // because 100vh/100dvh could over-report height vs. the actually-visible area above the
    // Windows taskbar at some zoom/DPI combos, making the last bit of a long page unreachable. If
    // that resurfaces, it needs a different fix (it's an OS/browser viewport-unit accuracy issue,
    // not a reason to go back to shared document scroll) - flag it rather than reverting this.
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1">
        <Sidebar open={sidebarOpen} collapsed={collapsed} />
        {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
        {/* min-w-0 is required here: a flex child otherwise refuses to shrink below its content's
            intrinsic width (the flexbox default is min-width: auto), so a wide table anywhere in
            <Outlet /> was expanding this whole column past the viewport, dragging the sidebar's
            row along with it horizontally instead of staying put while only the table scrolled. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Topbar
            onMenuClick={() => setSidebarOpen((o) => !o)}
            collapsed={collapsed}
            onCollapseToggle={() => setCollapsed((c) => !c)}
          />
          <main ref={mainRef} className="min-w-0 flex-1 overflow-y-auto p-4 pb-8 sm:p-6 sm:pb-10">
            <Outlet />
            <PreviewFooterNote />
          </main>
        </div>
      </div>
      <SystemAnnouncementPopup />
    </div>
  );
}

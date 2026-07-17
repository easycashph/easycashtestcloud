import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Landmark,
  Wallet,
  Menu,
  Users,
  Package,
  FileSpreadsheet,
  ShieldCheck,
  ScrollText,
  FileCheck2,
  BellRing,
  Settings,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import * as React from 'react';
import { AccountMenu } from '@/components/AccountMenu';
import { NotificationBell } from '@/components/NotificationBell';
import { PreviewFooterNote } from '@/components/PreviewBanner';
import { Button } from '@/components/ui/button';
import { COMPANY_INFO } from '@/lib/staticConfig';
import { useRole } from '@/lib/roleContext';
import { cn } from '@/lib/utils';

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
    items: [
      { to: '/admin/members', label: 'User Accounts', icon: ShieldCheck, end: false },
      { to: '/products', label: 'Loan Products', icon: Package, end: false },
      { to: '/admin/activity-logs', label: 'Activity Logs', icon: ScrollText, end: false },
      { to: '/admin/about', label: 'About', icon: Info, end: false },
    ],
  },
];

function Sidebar({ open, collapsed }: { open: boolean; collapsed: boolean }) {
  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out lg:relative',
        collapsed ? 'lg:w-0' : 'lg:w-64',
      )}
    >
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex min-h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-5 py-2">
          <img src="/logo-easycash.png" alt="Easycash logo" className="h-9 w-9 shrink-0 rounded bg-white object-contain p-0.5" />
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold leading-snug">{COMPANY_INFO.name}</p>
            <p className="truncate text-[11px] text-sidebar-foreground/60">{COMPANY_INFO.branchName} Branch</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">{group.label}</p>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => (
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
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
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

  return (
    // Deliberately NOT height-constrained to the viewport (no h-screen/h-dvh on this root) - a
    // fixed-height shell with an inner overflow-y-auto scroll region turned out unreliable on
    // Windows: 100vh AND 100dvh could both still report more height than was actually visible
    // above the taskbar at certain zoom/DPI combinations (confirmed live - 100dvh alone didn't
    // fix it), so the bottom of a long page like About was unreachable no matter how far the
    // inner region was scrolled. Switched to letting the page grow to its natural content height
    // and scroll via the browser's own document scroll instead, which only depends on real
    // document height, not a computed viewport unit - immune to this whole class of bug. The
    // sidebar and topbar use `sticky` (not `fixed`) so they still stay pinned during that scroll.
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1">
        <Sidebar open={sidebarOpen} collapsed={collapsed} />
        {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
        {/* min-w-0 is required here: a flex child otherwise refuses to shrink below its content's
            intrinsic width (the flexbox default is min-width: auto), so a wide table anywhere in
            <Outlet /> was expanding this whole column — and with it the row containing the
            sidebar — past the viewport, causing a page-level horizontal scrollbar that dragged the
            (sticky) sidebar along with it instead of staying put while only the table scrolled. */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            onMenuClick={() => setSidebarOpen((o) => !o)}
            collapsed={collapsed}
            onCollapseToggle={() => setCollapsed((c) => !c)}
          />
          <main className="min-w-0 flex-1 p-4 pb-8 sm:p-6 sm:pb-10">
            <Outlet />
          </main>
          <PreviewFooterNote />
        </div>
      </div>
    </div>
  );
}

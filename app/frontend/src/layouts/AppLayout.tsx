import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Landmark,
  Wallet,
  Menu,
  Users,
  Package,
  CalendarClock,
  PiggyBank,
  Receipt,
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
import { PreviewBanner, PreviewFooterNote } from '@/components/PreviewBanner';
import { Button } from '@/components/ui/button';
import { COMPANY_INFO } from '@/lib/mockData';
import { LMS_VERSION } from '@/lib/lmsVersion';
import { cn } from '@/lib/utils';

/**
 * Section/tab order confirmed by the business: Home → Loan → Collection → Configuration →
 * Administration (2026-07-08 — `Configuration` inserted before `Administration` as part of the
 * frontend↔backend wiring pilot's Stage 0c, see `docs/Architecture/
 * FRONTEND_BACKEND_WIRING_PILOT_DESIGN.md` §8.1; previous order, confirmed 2026-07-06, had no
 * `Configuration` group).
 */
const NAV_GROUPS = [
  {
    label: 'Home',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/reports/loans', label: 'Loan Report', icon: CalendarClock, end: false },
      { to: '/reports/collections', label: 'Collection Report', icon: PiggyBank, end: false },
      { to: '/reports/transactions', label: 'Transaction Report', icon: Receipt, end: false },
    ],
  },
  {
    label: 'Loan',
    items: [
      { to: '/applications', label: 'Loan Applications', icon: FileCheck2, end: false },
      { to: '/clients', label: 'Client Data', icon: Users, end: false },
      { to: '/loans', label: 'Loan Accounts', icon: Landmark, end: false },
    ],
  },
  {
    label: 'Collection',
    items: [
      { to: '/payments', label: 'Payment Recording', icon: Wallet, end: false },
      { to: '/reminders', label: 'Payment Reminders', icon: BellRing, end: false },
    ],
  },
  {
    label: 'Configuration',
    items: [{ to: '/configuration/settings', label: 'Settings', icon: Settings, end: false }],
  },
  {
    label: 'Administration',
    items: [
      { to: '/admin/members', label: 'Member Details', icon: ShieldCheck, end: false },
      { to: '/products', label: 'Loan Products', icon: Package, end: false },
      { to: '/admin/activity-logs', label: 'Activity Logs', icon: ScrollText, end: false },
      { to: '/admin/about', label: 'About', icon: Info, end: false },
    ],
  },
];

function Sidebar({ open, collapsed, onCollapse }: { open: boolean; collapsed: boolean; onCollapse: () => void }) {
  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out lg:relative',
        collapsed ? 'lg:w-0' : 'lg:w-64',
      )}
    >
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-sidebar-border px-5">
          <div className="flex items-center gap-3 overflow-hidden">
            <img src="/logo-easycash.png" alt="Easycash logo" className="h-9 w-9 shrink-0 rounded bg-white object-contain p-0.5" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">{COMPANY_INFO.name}</p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">{COMPANY_INFO.branchName} Branch</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hidden shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground lg:inline-flex"
            onClick={onCollapse}
            aria-label="Hide side menu"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
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
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/15 hover:text-sidebar-foreground',
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
        <div className="shrink-0 p-3">
          <p className="rounded-md border border-sidebar-border bg-sidebar-accent/10 px-3 py-2 text-[11px] leading-snug text-sidebar-foreground/70">
            UI Preview build — v{LMS_VERSION}. Sample data only.
          </p>
        </div>
      </aside>
    </div>
  );
}

/** Appearance now has exactly one control surface — Settings > Appearance (see SettingsPage) — the standalone toggle formerly here was removed 2026-07-08. */
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
    <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
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
        <AccountMenu />
      </div>
    </header>
  );
}

const SIDEBAR_COLLAPSED_KEY = 'lms.sidebarCollapsed';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  });

  React.useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <PreviewBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar open={sidebarOpen} collapsed={collapsed} onCollapse={() => setCollapsed(true)} />
        {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
        <div className="flex min-h-0 flex-1 flex-col">
          <Topbar
            onMenuClick={() => setSidebarOpen((o) => !o)}
            collapsed={collapsed}
            onCollapseToggle={() => setCollapsed((c) => !c)}
          />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">
            <Outlet />
          </main>
          <PreviewFooterNote />
        </div>
      </div>
    </div>
  );
}

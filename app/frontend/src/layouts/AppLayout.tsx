import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Landmark,
  Wallet,
  Moon,
  Sun,
  Menu,
  Users,
  Package,
  CalendarClock,
  PiggyBank,
  Receipt,
  ShieldCheck,
  ScrollText,
  FileCheck2,
  FileText,
  BellRing,
  Settings,
  Info,
} from 'lucide-react';
import * as React from 'react';
import { AccountSwitcher } from '@/components/AccountSwitcher';
import { PreviewBanner, PreviewFooterNote } from '@/components/PreviewBanner';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { COMPANY_INFO } from '@/lib/mockData';
import { LMS_VERSION } from '@/lib/lmsVersion';
import { cn } from '@/lib/utils';

/** Section/tab order confirmed by the business (2026-07-06): Home → Loan → Collection → Administration. */
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
    label: 'Administration',
    items: [
      { to: '/admin/configuration', label: 'LMS Configuration', icon: Settings, end: false },
      { to: '/admin/members', label: 'Member Details', icon: ShieldCheck, end: false },
      { to: '/admin/documents', label: 'Generated Documents', icon: FileText, end: false },
      { to: '/products', label: 'Loan Products', icon: Package, end: false },
      { to: '/admin/activity-logs', label: 'Activity Logs', icon: ScrollText, end: false },
      { to: '/admin/about', label: 'About', icon: Info, end: false },
    ],
  },
];

function Sidebar({ open }: { open: boolean }) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
        <img src="/logo-easycash.png" alt="Easycash logo" className="h-9 w-9 rounded bg-white object-contain p-0.5" />
        <div className="leading-tight">
          <p className="text-sm font-semibold">{COMPANY_INFO.name}</p>
          <p className="text-[11px] text-sidebar-foreground/60">{COMPANY_INFO.branchName} Branch</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-4 p-3">
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
                  <item.icon className="h-4 w-4" />
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
  );
}

function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <header className="flex h-16 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-sm font-semibold">Digital Lending Platform</h1>
          <p className="text-xs text-muted-foreground">Enterprise loan management</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <AccountSwitcher />
      </div>
    </header>
  );
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
      <PreviewBanner />
      <div className="flex">
        <Sidebar open={sidebarOpen} />
        {sidebarOpen && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
        <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
          <Topbar onMenuClick={() => setSidebarOpen((o) => !o)} />
          <main className="flex-1 p-4 sm:p-6">
            <Outlet />
          </main>
          <PreviewFooterNote />
        </div>
      </div>
    </div>
  );
}

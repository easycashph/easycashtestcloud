/**
 * Settings > Appearance > Landing Page (2026-07-17 user request) - which page each officer lands
 * on right after login, a personal per-user preference. Same storage pattern as
 * `theme-provider.tsx`'s theme/accent/fontSize (userId-suffixed localStorage key, `anon` scope
 * fallback), but deliberately a plain read/write module rather than a React context: it's only
 * read once per login (by `App.tsx`'s index route) and written from one place (Settings), so a
 * context/provider would add no value here.
 */
export type LandingPage = 'dashboard' | 'applications' | 'payments' | 'loans' | 'clients';

export const DEFAULT_LANDING_PAGE: LandingPage = 'dashboard';

export const LANDING_PAGE_OPTIONS: { value: LandingPage; label: string; path: string }[] = [
  { value: 'dashboard', label: 'Dashboard', path: '/' },
  { value: 'applications', label: 'Loan Applications', path: '/applications' },
  { value: 'payments', label: 'Payment Recording', path: '/payments' },
  { value: 'loans', label: 'Loan Accounts', path: '/loans' },
  { value: 'clients', label: 'Clients', path: '/clients' },
];

const LANDING_PAGE_VALUES = LANDING_PAGE_OPTIONS.map((o) => o.value);
const KEY_PREFIX = 'easycash-preview-landing-page';
const ANON_SCOPE = 'anon';

function storageKey(userId: string | null): string {
  return `${KEY_PREFIX}:${userId ?? ANON_SCOPE}`;
}

export function readLandingPage(userId: string | null): LandingPage {
  const stored = window.localStorage.getItem(storageKey(userId));
  return LANDING_PAGE_VALUES.includes(stored as LandingPage) ? (stored as LandingPage) : DEFAULT_LANDING_PAGE;
}

export function writeLandingPage(userId: string | null, value: LandingPage): void {
  window.localStorage.setItem(storageKey(userId), value);
}

export function landingPagePath(value: LandingPage): string {
  return LANDING_PAGE_OPTIONS.find((o) => o.value === value)?.path ?? '/';
}

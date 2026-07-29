import * as React from 'react';
import { arrayMove } from '@dnd-kit/sortable';

/** The 4 stat cards at the top of the Dashboard - reorder/show-hide/density is a personal,
 * per-user preference (2026-07-17), same storage pattern as `theme-provider.tsx`'s theme/accent. */
export type DashboardCardId = 'activeLoans' | 'collectionsThisMonth' | 'overdueAccounts' | 'portfolioGrowth';

export type DashboardDensity = 'comfortable' | 'compact';

export const DASHBOARD_CARD_LABELS: Record<DashboardCardId, string> = {
  activeLoans: 'Total Active Loans',
  collectionsThisMonth: 'Collections This Month',
  overdueAccounts: 'Overdue Accounts',
  portfolioGrowth: 'Portfolio Growth',
};

export interface DashboardCardPref {
  id: DashboardCardId;
  visible: boolean;
}

const DEFAULT_CARD_ORDER: DashboardCardId[] = ['activeLoans', 'collectionsThisMonth', 'overdueAccounts', 'portfolioGrowth'];
const DEFAULT_DENSITY: DashboardDensity = 'comfortable';
const DEFAULT_CARDS: DashboardCardPref[] = DEFAULT_CARD_ORDER.map((id) => ({ id, visible: true }));

interface DashboardLayoutContextValue {
  /** In display order - hidden cards stay in the list (visible: false) so Settings can still offer
   * to turn them back on in a stable position rather than always appending re-enabled cards last. */
  cards: DashboardCardPref[];
  density: DashboardDensity;
  toggleCardVisibility: (id: DashboardCardId) => void;
  moveCard: (id: DashboardCardId, direction: 'up' | 'down') => void;
  /** 2026-07-23: drag-to-reorder directly on the Dashboard cards (dnd-kit) - reorders within the
   * full `cards` list (not just the visible ones), same as `moveCard`, so a hidden card keeps its
   * relative position if later re-shown. */
  reorderCards: (activeId: DashboardCardId, overId: DashboardCardId) => void;
  setDensity: (density: DashboardDensity) => void;
  resetLayout: () => void;
  /** Switches whose saved preference is active - same contract as ThemeProvider's, called from
   * the same spots in `roleContext.tsx` (bootstrap, login, logout). */
  loadPreferenceFor: (userId: string | null) => void;
}

const DashboardLayoutContext = React.createContext<DashboardLayoutContextValue | undefined>(undefined);

const LAYOUT_KEY_PREFIX = 'easycash-preview-dashboard-layout';
const ANON_SCOPE = 'anon';

function layoutStorageKey(userId: string | null): string {
  return `${LAYOUT_KEY_PREFIX}:${userId ?? ANON_SCOPE}`;
}

/** Reconciles stored card prefs against the current known card set - drops any id that no longer
 * exists (a card was removed from the app) and appends any new id not yet in the stored list
 * (a card was added since the preference was saved), defaulting new ones to visible. */
function reconcileCards(stored: unknown): DashboardCardPref[] {
  const storedList = Array.isArray(stored) ? (stored as Partial<DashboardCardPref>[]) : [];
  const knownIds = new Set(DEFAULT_CARD_ORDER);
  const seenIds = new Set<DashboardCardId>();
  const reconciled: DashboardCardPref[] = [];
  for (const entry of storedList) {
    if (typeof entry?.id !== 'string' || !knownIds.has(entry.id as DashboardCardId) || seenIds.has(entry.id as DashboardCardId)) continue;
    seenIds.add(entry.id as DashboardCardId);
    reconciled.push({ id: entry.id as DashboardCardId, visible: entry.visible !== false });
  }
  for (const id of DEFAULT_CARD_ORDER) {
    if (!seenIds.has(id)) reconciled.push({ id, visible: true });
  }
  return reconciled;
}

function readCards(userId: string | null): DashboardCardPref[] {
  const stored = window.localStorage.getItem(layoutStorageKey(userId));
  if (!stored) return DEFAULT_CARDS;
  try {
    return reconcileCards(JSON.parse(stored));
  } catch {
    return DEFAULT_CARDS;
  }
}

function densityStorageKey(userId: string | null): string {
  return `${LAYOUT_KEY_PREFIX}-density:${userId ?? ANON_SCOPE}`;
}

function readDensity(userId: string | null): DashboardDensity {
  const stored = window.localStorage.getItem(densityStorageKey(userId));
  return stored === 'compact' || stored === 'comfortable' ? stored : DEFAULT_DENSITY;
}

export function DashboardLayoutProvider({ children }: { children: React.ReactNode }) {
  // Ref, not state - same reasoning as ThemeProvider's currentUserIdRef: mutated synchronously by
  // loadPreferenceFor(), read by the persistence effects below without itself triggering a re-render.
  const currentUserIdRef = React.useRef<string | null>(null);
  const [cards, setCards] = React.useState<DashboardCardPref[]>(() => readCards(null));
  const [density, setDensity] = React.useState<DashboardDensity>(() => readDensity(null));

  React.useEffect(() => {
    window.localStorage.setItem(layoutStorageKey(currentUserIdRef.current), JSON.stringify(cards));
  }, [cards]);

  React.useEffect(() => {
    window.localStorage.setItem(densityStorageKey(currentUserIdRef.current), density);
  }, [density]);

  const toggleCardVisibility = React.useCallback((id: DashboardCardId) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c)));
  }, []);

  const moveCard = React.useCallback((id: DashboardCardId, direction: 'up' | 'down') => {
    setCards((prev) => {
      const index = prev.findIndex((c) => c.id === id);
      const swapWith = direction === 'up' ? index - 1 : index + 1;
      if (index === -1 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[swapWith]] = [next[swapWith], next[index]];
      return next;
    });
  }, []);

  const reorderCards = React.useCallback((activeId: DashboardCardId, overId: DashboardCardId) => {
    setCards((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === activeId);
      const newIndex = prev.findIndex((c) => c.id === overId);
      return oldIndex === -1 || newIndex === -1 ? prev : arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const resetLayout = React.useCallback(() => {
    setCards(DEFAULT_CARDS);
    setDensity(DEFAULT_DENSITY);
  }, []);

  const loadPreferenceFor = React.useCallback((userId: string | null) => {
    currentUserIdRef.current = userId;
    setCards(readCards(userId));
    setDensity(readDensity(userId));
  }, []);

  return (
    <DashboardLayoutContext.Provider
      value={{ cards, density, toggleCardVisibility, moveCard, reorderCards, setDensity, resetLayout, loadPreferenceFor }}
    >
      {children}
    </DashboardLayoutContext.Provider>
  );
}

export function useDashboardLayout(): DashboardLayoutContextValue {
  const ctx = React.useContext(DashboardLayoutContext);
  if (!ctx) throw new Error('useDashboardLayout must be used within a DashboardLayoutProvider');
  return ctx;
}

import * as React from 'react';

type Theme = 'light' | 'dark';

/** Theme color presets, selectable from Settings > Theme Color - a personal, per-user preference (2026-07-08). Must match the `[data-accent='...']` blocks in `index.css`. */
export type Accent = 'emerald' | 'easycash-blue' | 'violet' | 'amber' | 'rose';

/** The platform's default theme color - business-confirmed as Easycash Emerald (not the legacy brand blue). */
export const DEFAULT_ACCENT: Accent = 'emerald';

export const ACCENT_OPTIONS: { value: Accent; label: string; swatch: string }[] = [
  { value: 'emerald', label: 'Easycash Emerald (default)', swatch: 'hsl(158 64% 32%)' },
  { value: 'easycash-blue', label: 'Easycash Blue', swatch: 'hsl(213 74% 40%)' },
  { value: 'violet', label: 'Violet', swatch: 'hsl(262 60% 50%)' },
  { value: 'amber', label: 'Amber', swatch: 'hsl(32 92% 46%)' },
  { value: 'rose', label: 'Rose', swatch: 'hsl(348 70% 48%)' },
];

const ACCENT_VALUES = ACCENT_OPTIONS.map((o) => o.value);

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
  /**
   * Switches whose saved preference is active. Called by `roleContext.tsx` on bootstrap, login,
   * and logout - `userId: null` means "no signed-in user," which loads the system-preference/
   * default look (used for the Login page itself, so it never leaks the last signed-in user's
   * personal accent to whoever's next at the machine).
   */
  loadPreferenceFor: (userId: string | null) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

const THEME_KEY_PREFIX = 'easycash-preview-theme';
const ACCENT_KEY_PREFIX = 'easycash-preview-accent';
const ANON_SCOPE = 'anon';

function themeStorageKey(userId: string | null): string {
  return `${THEME_KEY_PREFIX}:${userId ?? ANON_SCOPE}`;
}
function accentStorageKey(userId: string | null): string {
  return `${ACCENT_KEY_PREFIX}:${userId ?? ANON_SCOPE}`;
}

function readTheme(userId: string | null): Theme {
  const stored = window.localStorage.getItem(themeStorageKey(userId));
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readAccent(userId: string | null): Accent {
  const stored = window.localStorage.getItem(accentStorageKey(userId));
  return ACCENT_VALUES.includes(stored as Accent) ? (stored as Accent) : DEFAULT_ACCENT;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Ref, not state: mutated synchronously by loadPreferenceFor() and read by the persistence
  // effects below at their next run, without itself needing to trigger a re-render.
  const currentUserIdRef = React.useRef<string | null>(null);
  const [theme, setTheme] = React.useState<Theme>(() => readTheme(null));
  const [accent, setAccent] = React.useState<Accent>(() => readAccent(null));

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(themeStorageKey(currentUserIdRef.current), theme);
  }, [theme]);

  React.useEffect(() => {
    document.documentElement.dataset.accent = accent;
    window.localStorage.setItem(accentStorageKey(currentUserIdRef.current), accent);
  }, [accent]);

  const toggleTheme = React.useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const loadPreferenceFor = React.useCallback((userId: string | null) => {
    currentUserIdRef.current = userId;
    setTheme(readTheme(userId));
    setAccent(readAccent(userId));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accent, setAccent, loadPreferenceFor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

import * as React from 'react';

type Theme = 'light' | 'dark';

/** Theme color presets selectable from LMS Configuration (MIS-only). Must match the `[data-accent='...']` blocks in `index.css`. */
export type Accent = 'emerald' | 'easycash-blue' | 'violet' | 'amber' | 'rose';

/** The platform's default theme color — business-confirmed as Easycash Emerald (not the legacy brand blue). */
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
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'easycash-preview-theme';
const ACCENT_STORAGE_KEY = 'easycash-preview-accent';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [accent, setAccent] = React.useState<Accent>(() => {
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return ACCENT_VALUES.includes(stored as Accent) ? (stored as Accent) : DEFAULT_ACCENT;
  });

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  React.useEffect(() => {
    document.documentElement.dataset.accent = accent;
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  }, [accent]);

  const toggleTheme = React.useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme, accent, setAccent }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

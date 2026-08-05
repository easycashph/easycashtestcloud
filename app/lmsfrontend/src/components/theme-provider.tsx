import * as React from 'react';

type Theme = 'light' | 'dark';

/** Theme color presets, selectable from Settings > Theme Color - a personal, per-user preference (2026-07-08). Must match the `[data-accent='...']` blocks in `index.css`.
 * Violet/Amber/Rose removed 2026-07-17 (user request) - Emerald and Easycash Blue remain the only
 * presets. 'custom' is the one exception - it has no static CSS block, since its color is
 * arbitrary (a user-picked hex). See `applyCustomAccent()` below. */
export type Accent = 'emerald' | 'easycash-blue' | 'custom';

/** The platform's default theme color - business-confirmed as Easycash Emerald (not the legacy brand blue). */
export const DEFAULT_ACCENT: Accent = 'emerald';

/** Fallback shown for the "Custom" swatch before the officer has picked their own color. */
export const DEFAULT_CUSTOM_COLOR = '#0f766e';

export const ACCENT_OPTIONS: { value: Exclude<Accent, 'custom'>; label: string; swatch: string }[] = [
  { value: 'emerald', label: 'Easycash Emerald (default)', swatch: 'hsl(158 64% 32%)' },
  { value: 'easycash-blue', label: 'Easycash Blue', swatch: 'hsl(213 74% 40%)' },
];

const ACCENT_VALUES = [...ACCENT_OPTIONS.map((o) => o.value), 'custom'] as Accent[];

/** #rrggbb -> {h, s, l} (0-360, 0-100, 0-100), matching the unitless "H S% L%" format every
 * `--primary`/`--ring`/etc. CSS variable in `index.css` is written in (consumed via `hsl(var(--x))`). */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const r = parseInt(match[1].slice(0, 2), 16) / 255;
  const g = parseInt(match[1].slice(2, 4), 16) / 255;
  const b = parseInt(match[1].slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Applies a user-picked hex color as the accent, via inline CSS variables (which win over any
 * stylesheet rule targeting the same `<html>` element, so no `[data-accent='custom']` block is
 * needed in index.css). Clamps lightness per mode - a bright color picked for dark-mode legibility
 * would otherwise be nearly invisible against a white light-mode background, and vice versa -
 * mirroring the light/dark split every preset in index.css already does, just computed instead of
 * hand-tuned per color. Returns false (leaving the previous accent's variables in place) if `hex`
 * isn't valid, e.g. mid-typing in the color input. */
function applyCustomAccent(hex: string): boolean {
  const hsl = hexToHsl(hex);
  if (!hsl) return false;
  const isDark = document.documentElement.classList.contains('dark');
  const l = isDark ? Math.max(hsl.l, 55) : Math.min(hsl.l, 45);
  const value = `${hsl.h} ${hsl.s}% ${l}%`;
  const style = document.documentElement.style;
  style.setProperty('--primary', value);
  style.setProperty('--ring', value);
  style.setProperty('--sidebar-accent', value);
  style.setProperty('--chart-1', `${hsl.h} ${hsl.s}% ${Math.min(l + (isDark ? 5 : 10), 75)}%`);
  return true;
}

function clearCustomAccent(): void {
  const style = document.documentElement.style;
  style.removeProperty('--primary');
  style.removeProperty('--ring');
  style.removeProperty('--sidebar-accent');
  style.removeProperty('--chart-1');
}

/** App-wide text size preference (2026-07-17 user request) - a personal, per-user preference like
 * theme/accent, driven by `[data-font-size]` on `<html>` (see `index.css`), which scales the root
 * font-size so every `rem`-based Tailwind utility across the app scales with it. */
export type FontSize = 'small' | 'medium' | 'large';

export const DEFAULT_FONT_SIZE: FontSize = 'medium';

export const FONT_SIZE_OPTIONS: { value: FontSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium (default)' },
  { value: 'large', label: 'Large' },
];

const FONT_SIZE_VALUES = FONT_SIZE_OPTIONS.map((o) => o.value);

/** Settings > Appearance > Card Reordering (2026-07-28 user request) - a personal, per-user on/off
 * switch for the drag-and-drop card reordering feature (`SortableSection`, Dashboard's
 * `DraggableStatCard`) across every page that has it. Off hides every drag handle and disables
 * dragging outright (via dnd-kit's own `disabled` option) - it does NOT reset the officer's already
 * saved card order, just stops further rearranging until switched back on. */
export const DEFAULT_DRAG_REORDER_ENABLED = false;

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
  /** The officer's picked hex color - only meaningful (and only actually applied) while `accent === 'custom'`, but kept around so the color input still shows their last pick after switching to a preset and back. */
  customColor: string;
  setCustomColor: (hex: string) => void;
  fontSize: FontSize;
  setFontSize: (fontSize: FontSize) => void;
  dragReorderEnabled: boolean;
  setDragReorderEnabled: (enabled: boolean) => void;
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
const CUSTOM_COLOR_KEY_PREFIX = 'easycash-preview-custom-color';
const FONT_SIZE_KEY_PREFIX = 'easycash-preview-font-size';
const DRAG_REORDER_KEY_PREFIX = 'easycash-preview-drag-reorder-enabled';
const ANON_SCOPE = 'anon';

function themeStorageKey(userId: string | null): string {
  return `${THEME_KEY_PREFIX}:${userId ?? ANON_SCOPE}`;
}
function accentStorageKey(userId: string | null): string {
  return `${ACCENT_KEY_PREFIX}:${userId ?? ANON_SCOPE}`;
}
function customColorStorageKey(userId: string | null): string {
  return `${CUSTOM_COLOR_KEY_PREFIX}:${userId ?? ANON_SCOPE}`;
}
function fontSizeStorageKey(userId: string | null): string {
  return `${FONT_SIZE_KEY_PREFIX}:${userId ?? ANON_SCOPE}`;
}
function dragReorderStorageKey(userId: string | null): string {
  return `${DRAG_REORDER_KEY_PREFIX}:${userId ?? ANON_SCOPE}`;
}

/** 2026-08-05 (user request): dark, not the OS/browser's `prefers-color-scheme`, is the platform
 * default for anyone who hasn't picked a theme yet - a new officer's first login, or the Login
 * page itself before anyone's signed in. Anyone who has already chosen light or dark (`stored`
 * below) keeps that choice untouched; this only changes what a never-configured user sees. */
export const DEFAULT_THEME: Theme = 'dark';

function readTheme(userId: string | null): Theme {
  const stored = window.localStorage.getItem(themeStorageKey(userId));
  if (stored === 'light' || stored === 'dark') return stored;
  return DEFAULT_THEME;
}

function readAccent(userId: string | null): Accent {
  const stored = window.localStorage.getItem(accentStorageKey(userId));
  return ACCENT_VALUES.includes(stored as Accent) ? (stored as Accent) : DEFAULT_ACCENT;
}

function readCustomColor(userId: string | null): string {
  const stored = window.localStorage.getItem(customColorStorageKey(userId));
  return stored && hexToHsl(stored) ? stored : DEFAULT_CUSTOM_COLOR;
}

function readFontSize(userId: string | null): FontSize {
  const stored = window.localStorage.getItem(fontSizeStorageKey(userId));
  return FONT_SIZE_VALUES.includes(stored as FontSize) ? (stored as FontSize) : DEFAULT_FONT_SIZE;
}

function readDragReorderEnabled(userId: string | null): boolean {
  const stored = window.localStorage.getItem(dragReorderStorageKey(userId));
  if (stored === 'true') return true;
  if (stored === 'false') return false;
  return DEFAULT_DRAG_REORDER_ENABLED;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Ref, not state: mutated synchronously by loadPreferenceFor() and read by the persistence
  // effects below at their next run, without itself needing to trigger a re-render.
  const currentUserIdRef = React.useRef<string | null>(null);
  const [theme, setTheme] = React.useState<Theme>(() => readTheme(null));
  const [accent, setAccent] = React.useState<Accent>(() => readAccent(null));
  const [customColor, setCustomColor] = React.useState<string>(() => readCustomColor(null));
  const [fontSize, setFontSize] = React.useState<FontSize>(() => readFontSize(null));
  const [dragReorderEnabled, setDragReorderEnabled] = React.useState<boolean>(() => readDragReorderEnabled(null));

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    window.localStorage.setItem(themeStorageKey(currentUserIdRef.current), theme);
  }, [theme]);

  React.useEffect(() => {
    document.documentElement.dataset.accent = accent;
    window.localStorage.setItem(accentStorageKey(currentUserIdRef.current), accent);
    if (accent === 'custom') applyCustomAccent(customColor);
    else clearCustomAccent();
    // Re-applying on `theme` change too - the custom accent's light/dark clamp (see
    // applyCustomAccent) needs to be recomputed whenever dark mode is toggled while a custom color
    // is active, same as every preset's own light/dark CSS block already does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent, theme]);

  React.useEffect(() => {
    window.localStorage.setItem(customColorStorageKey(currentUserIdRef.current), customColor);
    if (accent === 'custom') applyCustomAccent(customColor);
  }, [customColor, accent]);

  React.useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
    window.localStorage.setItem(fontSizeStorageKey(currentUserIdRef.current), fontSize);
  }, [fontSize]);

  React.useEffect(() => {
    window.localStorage.setItem(dragReorderStorageKey(currentUserIdRef.current), String(dragReorderEnabled));
  }, [dragReorderEnabled]);

  const toggleTheme = React.useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const loadPreferenceFor = React.useCallback((userId: string | null) => {
    currentUserIdRef.current = userId;
    setTheme(readTheme(userId));
    setAccent(readAccent(userId));
    setCustomColor(readCustomColor(userId));
    setFontSize(readFontSize(userId));
    setDragReorderEnabled(readDragReorderEnabled(userId));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        accent,
        setAccent,
        customColor,
        setCustomColor,
        fontSize,
        setFontSize,
        dragReorderEnabled,
        setDragReorderEnabled,
        loadPreferenceFor,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

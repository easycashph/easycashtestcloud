import type { Config } from 'tailwindcss';

/** Mirrors app/frontend's tailwind.config.ts CSS-variable theming approach for visual consistency
 * with the internal LMS, trimmed to only what this smaller app actually uses. */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        /** Easycash logo lime green - accent only (gradients, small highlights). See index.css's
         * --brand-green comment. Not a general-purpose color; reach for `primary` first. */
        'brand-green': {
          DEFAULT: 'hsl(var(--brand-green))',
          foreground: 'hsl(var(--brand-green-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        /** Serif display face for headlines only (2026-09-05 redesign) - never body text. */
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
      },
      keyframes: {
        /** News Flash ticker (2026-08-20 user request: "gumagalaw from right to left...
         * katulad ng NBA drafting pick") - translates one full copy-width to the left; the
         * ticker renders the item list twice back to back so the loop point is invisible. */
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        marquee: 'marquee 30s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config;

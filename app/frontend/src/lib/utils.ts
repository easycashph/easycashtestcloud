import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Presentation-only PHP currency formatting for the mock-data preview. */
export function formatPeso(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(amount);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

/** Date AND time — used where the exact moment matters, e.g. Activity Logs (every entry must be timestamped, not just dated). */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** Recharts' `Tooltip formatter` prop accepts values that may not be plain numbers (arrays, strings, undefined) — narrow before formatting. */
export function pesoTooltipFormatter(value: unknown): string {
  return formatPeso(typeof value === 'number' ? value : Number(value ?? 0));
}

import { cn } from '@/lib/utils';

/**
 * A pulsing placeholder bar, used to build loading skeletons that mirror the shape of the content
 * they stand in for.
 *
 * Replaces plain "Loading…" text, which `CLAUDE.md`'s UX requirements call out by name ("Loading
 * Skeletons"). A shape-matched skeleton tells the visitor what kind of content is coming and
 * roughly how much of it, instead of a blank pause.
 *
 * Uses Tailwind's `animate-pulse` (a CSS animation), which the site-wide
 * `prefers-reduced-motion: reduce` rule in `index.css` already disables for users who have that OS
 * setting on - no separate handling needed here.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

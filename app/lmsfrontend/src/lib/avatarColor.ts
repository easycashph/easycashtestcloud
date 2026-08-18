/**
 * 2026-08-18 (user request): deterministic per-name avatar color, so different people's initials
 * circles are visually distinct at a glance across a list (Member List, activity timelines, loan
 * applicant avatars, etc.) instead of every avatar sharing the same neutral fill. Same name always
 * resolves to the same color (a hash of the name, not random), so a person's avatar color stays
 * consistent across page loads and across every place their name appears.
 */
const AVATAR_PALETTE = [
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
] as const;

/** Tailwind `bg-*`/`text-*` classes for an avatar fallback, deterministic per `name`. */
export function avatarColorClasses(name: string | null | undefined): string {
  const key = (name ?? '').trim();
  if (!key) return AVATAR_PALETTE[0];
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]!;
}

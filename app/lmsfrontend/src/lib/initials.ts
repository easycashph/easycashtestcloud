/** Up to 2 uppercase initials from a display name (e.g. "Jomer Biason" -> "JB"), for avatar circles. */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

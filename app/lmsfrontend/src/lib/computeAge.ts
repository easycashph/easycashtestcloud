/** Shared "computed age" helper (2026-07-31 user request: show a live computed-age hint next to
 * every birth date field, not just the loan application forms that already had their own inline
 * copy of this exact logic). Returns null for an empty/invalid date rather than throwing, so
 * callers can render nothing until a real date is entered. */
export function computeAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age -= 1;
  return age;
}

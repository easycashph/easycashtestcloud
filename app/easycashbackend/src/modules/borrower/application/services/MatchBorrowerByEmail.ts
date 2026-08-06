import type { Borrower } from '../../domain/Borrower';
import type { IBorrowerRepository } from '../ports/IBorrowerRepository';

export type BorrowerEmailMatchResult =
  | { outcome: 'none' }
  | { outcome: 'matched'; borrower: Borrower }
  | { outcome: 'ambiguous'; borrowerIds: string[] };

/**
 * 2026-08-06 (Bind existing Client data to Portal, explicit user decision): `Borrower.email` has
 * no uniqueness constraint (common with legacy CP12 data - shared family emails, placeholders,
 * etc.), so an automated email match must never silently guess between multiple candidates. Used
 * by both the signup auto-bind path (`VerifySignUpUseCase`) and the unlinked-account backfill
 * script - a single place implementing the 0/1/2+ rule so both stay consistent.
 */
export async function matchBorrowerByEmail(borrowerRepository: IBorrowerRepository, email: string): Promise<BorrowerEmailMatchResult> {
  const matches = await borrowerRepository.findManyByEmail(email);
  if (matches.length === 0) return { outcome: 'none' };
  if (matches.length === 1) return { outcome: 'matched', borrower: matches[0]! };
  return { outcome: 'ambiguous', borrowerIds: matches.map((b) => b.id) };
}

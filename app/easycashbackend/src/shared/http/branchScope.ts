import type { Request } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import { ForbiddenError } from '@shared/errors/DomainError';

/**
 * Milestone 8.1 remediation (audit finding H-1): branch-scoped
 * authorization, deliberately kept SEPARATE from role authorization
 * (`requireRole`/ADR-043) — this is a data-scoping concern ("which rows
 * may this user see/write"), not a "may this user call this endpoint at
 * all" concern. Still one hard-coded global-roles list, no database
 * lookup, no per-branch configurability (ADR-038 §2 kept this mechanism).
 *
 * ADR-038 §3.2 (business-confirmed, 2026-07-06): MIS is the only global
 * role (sees/writes every branch); every other confirmed role (Loan
 * Operation Manager, CRM, Finance, Accounting, Collection Officer) is
 * scoped to their own branch only. Supersedes the old, unverified
 * assumption that `Administrator` (a role that no longer exists) was
 * global.
 */
const GLOBAL_ROLES = ['MIS'];

export interface BranchScope {
  /** The authenticated user's own branch. */
  branchId: string;
  /** True if this user may access every branch's data, not just their own. */
  isGlobal: boolean;
}

/** Reads the already-verified JWT claims (populated by `requireAuth`) into a `BranchScope`. */
export function resolveBranchScope(req: Request): BranchScope {
  const currentUser = getCurrentUser(req);
  return {
    branchId: currentUser.branchId,
    isGlobal: currentUser.roles.some((role) => GLOBAL_ROLES.includes(role)),
  };
}

/**
 * Throws `ForbiddenError` (403) if `resourceBranchId` isn't accessible
 * under `scope` — used after fetching a single resource that carries its
 * own `branchId`, so a non-global user can't read/act on another
 * branch's record just by guessing its id.
 */
export function assertBranchAccess(scope: BranchScope, resourceBranchId: string): void {
  if (!scope.isGlobal && scope.branchId !== resourceBranchId) {
    throw new ForbiddenError('This resource belongs to a different branch.');
  }
}

/**
 * Returns the `branchId` a query should be filtered to — `undefined` for
 * a global user (no filter, sees every branch), the user's own
 * `branchId` otherwise. Used by list endpoints, where filtering must
 * happen at the query level (not after fetching a page) to keep
 * pagination correct.
 */
export function resolveBranchFilter(scope: BranchScope): string | undefined {
  return scope.isGlobal ? undefined : scope.branchId;
}

/**
 * Returns the `branchId` a new record should be created under: a
 * non-global user's own branch always wins, regardless of what the
 * client put in the request body (never trust client-supplied branchId
 * for a scoped user). A global user's client-supplied value is trusted,
 * since a global user may legitimately originate records for any branch.
 */
export function resolveWriteBranchId(scope: BranchScope, requestedBranchId: string): string {
  return scope.isGlobal ? requestedBranchId : scope.branchId;
}

import type { TransactionContext } from '../TransactionContext';

/**
 * Same shape as `identity`'s `AuditLogEntry`
 * (`modules/identity/application/ports/IAuditLogger.ts`), deliberately
 * redeclared here rather than imported from it: `shared/` must not depend
 * on any one module (Clean Architecture dependency direction — modules
 * depend on `shared/`, never the reverse). Per
 * `docs/Architecture/ADR-financial-audit-isolation.md` §5, the exact shape
 * is intentionally left open for future refinement; this is the minimal
 * shape `PROJECT_RULES.md §Audit Trail` requires (User, Timestamp, Action,
 * Previous Value, New Value, IP, Browser — `createdAt`/timestamp is
 * populated by the database default, not passed in here).
 */
export interface AuditLogEntry {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * `docs/Architecture/ADR-financial-audit-isolation.md`: the financial-
 * module counterpart to identity's `IAuditLogger`, with the opposite
 * failure contract.
 *
 * Deliberately placed in `shared/application/ports/`, not inside any one
 * module — needed by every module that performs a financial state change
 * (`loan-account`, `ledger`, `repayment`), mirroring why `IUnitOfWork`
 * lives here rather than in a single module (ADR-042 §9).
 */
export interface IFinancialAuditLogger {
  /**
   * ADR-financial-audit-isolation §1: implementations MUST throw/propagate
   * on failure — the exact opposite contract of identity's
   * `IAuditLogger.log()`. An unaudited financial state change is a worse
   * outcome than a failed write, so a failure here must abort whatever
   * transaction it's part of, not be swallowed.
   *
   * Callers performing a financial write must supply the same `ctx` they
   * pass to every other repository call inside that write's
   * `IUnitOfWork.run()` block, so this write commits or rolls back
   * atomically with the financial state change it accompanies — never
   * before or after that transaction.
   */
  log(entry: AuditLogEntry, ctx?: TransactionContext): Promise<void>;
}

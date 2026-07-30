/**
 * Opaque marker type representing "the current unit-of-work's transactional
 * database session." Deliberately empty/opaque at the application layer —
 * per ADR-042 §9, `IUnitOfWork` supplies the transaction *boundary*
 * without requiring the application layer to know anything about how it's
 * implemented (Prisma, or otherwise).
 *
 * Repository ports accept an optional `TransactionContext` on every
 * mutating method: when supplied (inside `IUnitOfWork.run()`), the write
 * participates in that transaction; when omitted, the repository falls
 * back to its own standalone connection. Only `shared/infrastructure/`
 * code is allowed to know what's actually inside this object — see
 * `PrismaUnitOfWork.ts`.
 */
export interface TransactionContext {
  readonly __brand: 'TransactionContext';
}

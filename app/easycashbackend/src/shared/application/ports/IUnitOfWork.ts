import type { TransactionContext } from '../TransactionContext';

/**
 * Cross-module transactional-boundary port. See ADR-042 §9-§10: aggregates
 * are kept small (minimum unit of *consistency*), and `IUnitOfWork` is the
 * explicit mechanism a use case reaches for when it needs a wider unit of
 * *atomicity* spanning more than one aggregate's repository.
 *
 * Lives in `shared/application/` rather than any one module's
 * `application/ports/` because, unlike a repository port (owned by exactly
 * one module's aggregate), a unit of work is needed by any use case that
 * coordinates repositories across module boundaries — placing it inside a
 * single module would wrongly scope it and force other modules to reach
 * across module boundaries to use it.
 *
 * Framework-free: this interface says nothing about Prisma or SQL
 * transactions specifically. `shared/infrastructure/PrismaUnitOfWork.ts` is
 * the only place that concrete implementation detail is allowed to exist.
 */
export interface IUnitOfWork {
  /**
   * Runs `work` inside a single atomic transaction. If `work` throws (or
   * its returned promise rejects), every write performed through the
   * supplied `TransactionContext` is rolled back. Repository methods that
   * accept a `TransactionContext` must be called with the `ctx` passed
   * into `work` for their writes to participate in this transaction.
   */
  run<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}

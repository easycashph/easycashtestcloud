import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@shared/database/prismaClient';
import type { IUnitOfWork } from '@shared/application/ports/IUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';

/**
 * The only place allowed to know that `TransactionContext` is, in reality,
 * a wrapper around Prisma's `Prisma.TransactionClient`. Every Prisma-backed
 * repository across every module resolves the client it should issue
 * queries against through `resolveClient()` below, rather than importing
 * `prisma` (the standalone singleton) directly for mutating operations.
 */
interface PrismaTransactionContext extends TransactionContext {
  readonly client: Prisma.TransactionClient;
}

function isPrismaTransactionContext(ctx: TransactionContext): ctx is PrismaTransactionContext {
  return 'client' in ctx;
}

/**
 * Resolves the Prisma client a repository method should use: the
 * transactional client bound to the current `IUnitOfWork.run()` call, if
 * one was supplied, or the shared standalone singleton otherwise. Used by
 * every Prisma-backed repository's mutating methods so they can
 * participate in a caller-supplied transaction without each repository
 * reimplementing this resolution logic.
 */
export function resolveClient(ctx?: TransactionContext): PrismaClient | Prisma.TransactionClient {
  if (!ctx) {
    return prisma;
  }
  if (!isPrismaTransactionContext(ctx)) {
    // Defensive: this can only happen if some other IUnitOfWork
    // implementation's TransactionContext were passed to a Prisma
    // repository — there is currently only one implementation, but this
    // guards against a future integration mistake rather than silently
    // querying outside the intended transaction.
    throw new Error('Unrecognized TransactionContext: expected a PrismaUnitOfWork-issued context.');
  }
  return ctx.client;
}

/**
 * Prisma-backed implementation of IUnitOfWork (ADR-042 §9). Wraps
 * `prisma.$transaction`, the same primitive already proven by
 * `PrismaRefreshTokenRepository.rotate()` (Milestone 6) for a single
 * repository's internal two-step write — generalized here into a
 * cross-module primitive so any use case can coordinate multiple modules'
 * repositories atomically.
 */
export class PrismaUnitOfWork implements IUnitOfWork {
  async run<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      const ctx: PrismaTransactionContext = { __brand: 'TransactionContext', client: tx };
      return work(ctx);
    });
  }
}

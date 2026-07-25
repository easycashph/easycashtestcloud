import type { Prisma, PrismaClient } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { LoanSigningSession, type LoanSigningSessionProps } from '../domain/LoanSigningSession';
import type { ILoanSigningSessionRepository } from '../application/ports/ILoanSigningSessionRepository';

type PrismaWriteClient = PrismaClient | Prisma.TransactionClient;

const WITH_DOCUMENTS = { documents: { orderBy: { sortIndex: 'asc' as const } } };
type SessionRow = Prisma.LoanSigningSessionGetPayload<{ include: typeof WITH_DOCUMENTS }>;

function toDomain(row: SessionRow): LoanSigningSession {
  const props: LoanSigningSessionProps = {
    id: row.id,
    loanAccountId: row.loanAccountId,
    partyType: row.partyType,
    coBorrowerId: row.coBorrowerId ?? undefined,
    phoneNumber: row.phoneNumber,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt ?? undefined,
    otpCodeHash: row.otpCodeHash ?? undefined,
    otpExpiresAt: row.otpExpiresAt ?? undefined,
    otpVerifiedAt: row.otpVerifiedAt ?? undefined,
    createdByUserId: row.createdByUserId,
    createdByIp: row.createdByIp ?? undefined,
    createdAt: row.createdAt,
    documents: row.documents.map((d) => ({
      id: d.id,
      generatedLoanDocumentId: d.generatedLoanDocumentId,
      sortIndex: d.sortIndex,
      signedAt: d.signedAt ?? undefined,
      signedStorageKey: d.signedStorageKey ?? undefined,
      signedByIp: d.signedByIp ?? undefined,
      signedUserAgent: d.signedUserAgent ?? undefined,
    })),
  };
  return LoanSigningSession.reconstitute(props);
}

export class PrismaLoanSigningSessionRepository implements ILoanSigningSessionRepository {
  async create(session: LoanSigningSession, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx) as PrismaWriteClient;
    const p = session.toProps();
    await client.loanSigningSession.create({
      data: {
        id: p.id,
        loanAccountId: p.loanAccountId,
        partyType: p.partyType,
        coBorrowerId: p.coBorrowerId,
        phoneNumber: p.phoneNumber,
        tokenHash: p.tokenHash,
        expiresAt: p.expiresAt,
        createdByUserId: p.createdByUserId,
        createdByIp: p.createdByIp,
        createdAt: p.createdAt,
        documents: {
          create: p.documents.map((d) => ({
            id: d.id,
            generatedLoanDocumentId: d.generatedLoanDocumentId,
            sortIndex: d.sortIndex,
          })),
        },
      },
    });
  }

  async findByTokenHash(tokenHash: string, ctx?: TransactionContext): Promise<LoanSigningSession | null> {
    const client = resolveClient(ctx);
    const row = await client.loanSigningSession.findUnique({ where: { tokenHash }, include: WITH_DOCUMENTS });
    return row ? toDomain(row) : null;
  }

  async findById(id: string, ctx?: TransactionContext): Promise<LoanSigningSession | null> {
    const client = resolveClient(ctx);
    const row = await client.loanSigningSession.findUnique({ where: { id }, include: WITH_DOCUMENTS });
    return row ? toDomain(row) : null;
  }

  async findManyByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanSigningSession[]> {
    const client = resolveClient(ctx);
    const rows = await client.loanSigningSession.findMany({
      where: { loanAccountId },
      include: WITH_DOCUMENTS,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async save(session: LoanSigningSession, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx) as PrismaWriteClient;
    const p = session.toProps();
    await client.loanSigningSession.update({
      where: { id: p.id },
      data: {
        revokedAt: p.revokedAt,
        otpCodeHash: p.otpCodeHash,
        otpExpiresAt: p.otpExpiresAt,
        otpVerifiedAt: p.otpVerifiedAt,
      },
    });
    for (const d of p.documents) {
      await client.loanSigningDocument.update({
        where: { id: d.id },
        data: {
          signedAt: d.signedAt,
          signedStorageKey: d.signedStorageKey,
          signedByIp: d.signedByIp,
          signedUserAgent: d.signedUserAgent,
        },
      });
    }
  }
}


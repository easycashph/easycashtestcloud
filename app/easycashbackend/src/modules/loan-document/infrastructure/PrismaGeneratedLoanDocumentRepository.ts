import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { GeneratedLoanDocument, type GeneratedLoanDocumentProps } from '../domain/GeneratedLoanDocument';
import type { IGeneratedLoanDocumentRepository, GeneratedLoanDocumentView } from '../application/ports/IGeneratedLoanDocumentRepository';

type GeneratedLoanDocumentRow = Prisma.GeneratedLoanDocumentGetPayload<Record<string, never>>;

function toDomain(row: GeneratedLoanDocumentRow): GeneratedLoanDocument {
  const props: GeneratedLoanDocumentProps = {
    id: row.id,
    loanAccountId: row.loanAccountId,
    documentTemplateId: row.documentTemplateId,
    storageKey: row.storageKey,
    generatedByUserId: row.generatedByUserId,
    generatedAt: row.generatedAt,
  };
  return GeneratedLoanDocument.reconstitute(props);
}

export class PrismaGeneratedLoanDocumentRepository implements IGeneratedLoanDocumentRepository {
  async create(document: GeneratedLoanDocument, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.generatedLoanDocument.create({
      data: {
        id: document.id,
        loanAccountId: document.loanAccountId,
        documentTemplateId: document.documentTemplateId,
        storageKey: document.storageKey,
        generatedByUserId: document.generatedByUserId,
        generatedAt: document.generatedAt,
      },
    });
  }

  async findById(id: string, ctx?: TransactionContext): Promise<GeneratedLoanDocument | null> {
    const client = resolveClient(ctx);
    const row = await client.generatedLoanDocument.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  /** One row per `documentTemplateId` — the newest `generatedAt` — via Postgres `DISTINCT ON`. */
  async findLatestPerTemplateForLoanAccount(loanAccountId: string, ctx?: TransactionContext): Promise<GeneratedLoanDocumentView[]> {
    const client = resolveClient(ctx);
    const rows = await client.generatedLoanDocument.findMany({
      where: { loanAccountId },
      orderBy: { generatedAt: 'desc' },
      include: {
        documentTemplate: { select: { code: true, name: true, sortIndex: true } },
        generatedBy: { select: { firstName: true, lastName: true } },
      },
    });

    const latestByTemplate = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      if (!latestByTemplate.has(row.documentTemplateId)) {
        latestByTemplate.set(row.documentTemplateId, row);
      }
    }

    return [...latestByTemplate.values()]
      .sort((a, b) => a.documentTemplate.sortIndex - b.documentTemplate.sortIndex)
      .map((row) => ({
        id: row.id,
        loanAccountId: row.loanAccountId,
        documentTemplateId: row.documentTemplateId,
        documentTemplateCode: row.documentTemplate.code,
        documentTemplateName: row.documentTemplate.name,
        generatedByUserId: row.generatedByUserId,
        generatedByName: `${row.generatedBy.firstName} ${row.generatedBy.lastName}`.trim(),
        generatedAt: row.generatedAt,
      }));
  }
}

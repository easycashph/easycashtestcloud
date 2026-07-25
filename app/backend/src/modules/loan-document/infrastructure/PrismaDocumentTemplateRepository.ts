import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { DocumentTemplate, type DocumentTemplateProps } from '../domain/DocumentTemplate';
import type { IDocumentTemplateRepository } from '../application/ports/IDocumentTemplateRepository';

type DocumentTemplateRow = Prisma.DocumentTemplateGetPayload<Record<string, never>>;

function toDomain(row: DocumentTemplateRow): DocumentTemplate {
  const props: DocumentTemplateProps = {
    id: row.id,
    code: row.code,
    name: row.name,
    isRequired: row.isRequired,
    sortIndex: row.sortIndex,
    requiresBorrowerSignature: row.requiresBorrowerSignature,
    requiresCoBorrowerSignature: row.requiresCoBorrowerSignature,
  };
  return DocumentTemplate.reconstitute(props);
}

export class PrismaDocumentTemplateRepository implements IDocumentTemplateRepository {
  async findById(id: string, ctx?: TransactionContext): Promise<DocumentTemplate | null> {
    const client = resolveClient(ctx);
    const row = await client.documentTemplate.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByCode(code: string, ctx?: TransactionContext): Promise<DocumentTemplate | null> {
    const client = resolveClient(ctx);
    const row = await client.documentTemplate.findUnique({ where: { code } });
    return row ? toDomain(row) : null;
  }

  async findRequired(ctx?: TransactionContext): Promise<DocumentTemplate[]> {
    const client = resolveClient(ctx);
    const rows = await client.documentTemplate.findMany({
      where: { isRequired: true },
      orderBy: { sortIndex: 'asc' },
    });
    return rows.map(toDomain);
  }

  async findConditionalForLoanProduct(loanProductId: string, ctx?: TransactionContext): Promise<DocumentTemplate[]> {
    const client = resolveClient(ctx);
    const rows = await client.documentTemplate.findMany({
      where: { isRequired: false, productLinks: { some: { loanProductId } } },
      orderBy: { sortIndex: 'asc' },
    });
    return rows.map(toDomain);
  }
}

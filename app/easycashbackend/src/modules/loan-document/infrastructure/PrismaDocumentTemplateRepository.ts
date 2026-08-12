import type { Prisma } from '@prisma/client';
import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { DocumentTemplate, type DocumentTemplateProps } from '../domain/DocumentTemplate';
import type { DocumentTemplateProductMapping, IDocumentTemplateRepository } from '../application/ports/IDocumentTemplateRepository';

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

  async findAll(ctx?: TransactionContext): Promise<DocumentTemplate[]> {
    const client = resolveClient(ctx);
    const rows = await client.documentTemplate.findMany({ orderBy: { sortIndex: 'asc' } });
    return rows.map(toDomain);
  }

  async update(template: DocumentTemplate, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.documentTemplate.update({
      where: { id: template.id },
      data: {
        isRequired: template.isRequired,
        requiresBorrowerSignature: template.requiresBorrowerSignature,
        requiresCoBorrowerSignature: template.requiresCoBorrowerSignature,
      },
    });
  }

  async findAllProductMappings(ctx?: TransactionContext): Promise<DocumentTemplateProductMapping[]> {
    const client = resolveClient(ctx);
    const rows = await client.documentTemplateMapping.findMany({
      select: { documentTemplateId: true, loanProductId: true },
    });
    return rows;
  }

  async setProductMappings(templateId: string, loanProductIds: string[], ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.documentTemplateMapping.deleteMany({ where: { documentTemplateId: templateId } });
    if (loanProductIds.length > 0) {
      await client.documentTemplateMapping.createMany({
        data: loanProductIds.map((loanProductId) => ({ documentTemplateId: templateId, loanProductId })),
      });
    }
  }
}

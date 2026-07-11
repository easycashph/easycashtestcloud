import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import { LoanNote } from '../domain/LoanNote';
import type { ILoanNoteRepository, LoanNoteView } from '../application/ports/ILoanNoteRepository';

export class PrismaLoanNoteRepository implements ILoanNoteRepository {
  async create(note: LoanNote, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.loanNote.create({
      data: {
        id: note.id,
        loanAccountId: note.loanAccountId,
        authorUserId: note.authorUserId,
        text: note.text,
        createdAt: note.createdAt,
      },
    });
  }

  async findByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<LoanNoteView[]> {
    const client = resolveClient(ctx);
    const rows = await client.loanNote.findMany({
      where: { loanAccountId },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      loanAccountId: row.loanAccountId,
      authorUserId: row.authorUserId,
      authorName: `${row.author.firstName} ${row.author.lastName}`.trim(),
      text: row.text,
      createdAt: row.createdAt,
    }));
  }
}

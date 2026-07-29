import { resolveClient } from '@shared/infrastructure/PrismaUnitOfWork';
import type { TransactionContext } from '@shared/application/TransactionContext';
import type {
  CreateSigningNotificationLogInput,
  ISigningNotificationLogRepository,
  SigningNotificationLogRow,
} from '../application/ports/ISigningNotificationLogRepository';

export class PrismaSigningNotificationLogRepository implements ISigningNotificationLogRepository {
  async create(input: CreateSigningNotificationLogInput, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    await client.signingNotificationLog.create({
      data: {
        loanSigningSessionId: input.loanSigningSessionId,
        loanAccountId: input.loanAccountId,
        type: input.type,
        partyType: input.partyType,
        channel: input.channel,
        recipient: input.recipient,
      },
    });
  }

  async markLatestOtpVerified(loanSigningSessionId: string, verifiedAt: Date, ctx?: TransactionContext): Promise<void> {
    const client = resolveClient(ctx);
    const latest = await client.signingNotificationLog.findFirst({
      where: { loanSigningSessionId, type: 'OTP' },
      orderBy: { sentAt: 'desc' },
    });
    if (!latest) return;
    await client.signingNotificationLog.update({ where: { id: latest.id }, data: { verifiedAt } });
  }

  async listLogs(branchId: string | undefined, loanAccountId?: string, ctx?: TransactionContext): Promise<SigningNotificationLogRow[]> {
    const client = resolveClient(ctx);
    const rows = await client.signingNotificationLog.findMany({
      where: {
        ...(branchId ? { loanAccount: { branchId } } : {}),
        ...(loanAccountId ? { loanAccountId } : {}),
      },
      orderBy: { sentAt: 'desc' },
      include: {
        loanAccount: { select: { loanCode: true, branchId: true, borrower: { select: { firstName: true, lastName: true } } } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      loanAccountId: row.loanAccountId,
      loanCode: row.loanAccount.loanCode,
      branchId: row.loanAccount.branchId,
      borrowerName: `${row.loanAccount.borrower.firstName} ${row.loanAccount.borrower.lastName}`,
      type: row.type,
      partyType: row.partyType,
      channel: row.channel,
      recipient: row.recipient,
      sentAt: row.sentAt,
      verifiedAt: row.verifiedAt,
    }));
  }
}

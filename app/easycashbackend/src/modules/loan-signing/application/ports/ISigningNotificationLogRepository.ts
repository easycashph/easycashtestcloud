import type { TransactionContext } from '@shared/application/TransactionContext';

export interface CreateSigningNotificationLogInput {
  loanSigningSessionId: string;
  loanAccountId: string;
  type: 'LINK' | 'OTP';
  partyType: 'BORROWER' | 'CO_BORROWER';
  channel: string;
  recipient: string;
}

export interface SigningNotificationLogRow {
  id: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  type: 'LINK' | 'OTP';
  partyType: 'BORROWER' | 'CO_BORROWER';
  channel: string;
  recipient: string;
  sentAt: Date;
  verifiedAt: Date | null;
}

export interface ISigningNotificationLogRepository {
  /** Immutable, append-only rows (see the Prisma model's own doc comment) — never updated except by `markLatestOtpVerified`. */
  create(input: CreateSigningNotificationLogInput, ctx?: TransactionContext): Promise<void>;
  /** Sets `verifiedAt` on the most recently sent OTP row for this session — `LoanSigningSession.verifyOtp` always checks against the latest-issued code, so this is always the row that was actually verified. */
  markLatestOtpVerified(loanSigningSessionId: string, verifiedAt: Date, ctx?: TransactionContext): Promise<void>;
  listLogs(branchId: string | undefined, loanAccountId?: string, ctx?: TransactionContext): Promise<SigningNotificationLogRow[]>;
}

import type { ReminderTriggerType } from '@modules/sms-reminder/application/ports/ISmsReminderRepository';

export type { ReminderTriggerType };

/** Mirrors SmsReminderCandidate exactly (same 5-stage schedule, same underlying loan/installment
 * data), but keyed on `email` instead of `phoneNumber` - a candidate is skipped entirely if the
 * borrower has no email on file. */
export interface EmailReminderCandidate {
  installmentId: string | null;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  email: string;
  dueDate: Date | null;
  amountDueTotal: string;
  daysLate: number | null;
  totalAmountDue: string | null;
}

export interface LogEmailReminderSentInput {
  loanAccountId: string;
  installmentId: string | null;
  triggerType: ReminderTriggerType;
  triggerDate: Date;
  recipientEmail: string;
  message: string;
}

export interface LogEmailReminderFailedInput {
  loanAccountId: string;
  installmentId: string | null;
  triggerType: ReminderTriggerType;
  triggerDate: Date;
  recipientEmail: string;
  message: string;
  errorMessage: string;
}

export interface EmailReminderLogRow {
  id: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  recipientEmail: string;
  message: string;
  triggerType: ReminderTriggerType;
  triggerDate: Date;
  status: 'SENT' | 'FAILED';
  errorMessage: string | null;
  sentAt: Date;
}

export interface IEmailReminderRepository {
  findCandidatesDueOn(targetDate: Date, branchId: string | undefined): Promise<EmailReminderCandidate[]>;
  findPastDueCandidates(branchId: string | undefined): Promise<EmailReminderCandidate[]>;
  existsForTrigger(loanAccountId: string, triggerType: ReminderTriggerType, triggerDate: Date): Promise<boolean>;
  logSent(input: LogEmailReminderSentInput): Promise<void>;
  logFailed(input: LogEmailReminderFailedInput): Promise<void>;
  listLogs(branchId: string | undefined, loanAccountId?: string): Promise<EmailReminderLogRow[]>;
}

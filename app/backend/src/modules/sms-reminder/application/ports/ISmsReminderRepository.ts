/** Mirrors the Prisma `ReminderTriggerType` enum - the 5-stage business-confirmed schedule (see
 * that enum's own doc comment in schema.prisma). */
export type ReminderTriggerType = 'FIVE_DAYS_BEFORE' | 'THREE_DAYS_BEFORE' | 'ONE_DAY_BEFORE' | 'DUE_DATE' | 'PAST_DUE_WEEKLY';

/**
 * One candidate = one loan that should receive a reminder for a specific trigger, today.
 * `installmentId`/`dueDate`/`amountDueTotal` apply to the 4 date-anchored triggers (the loan's
 * next-due installment); `daysLate`/`totalAmountDue` apply only to `PAST_DUE_WEEKLY` (summed
 * across every overdue-and-unpaid installment, not just one) - see `renderReminderMessage`'s own
 * doc comment for which placeholder set each trigger type actually uses.
 */
export interface SmsReminderCandidate {
  installmentId: string | null;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  /** Raw as stored on Borrower.mobilePhone1 - M360 accepts +639.../639.../09.../9... as-is, see M360SmsGateway's own doc comment. */
  phoneNumber: string;
  dueDate: Date | null;
  amountDueTotal: string;
  daysLate: number | null;
  totalAmountDue: string | null;
}

export interface LogReminderSentInput {
  loanAccountId: string;
  installmentId: string | null;
  triggerType: ReminderTriggerType;
  triggerDate: Date;
  phoneNumber: string;
  message: string;
  providerTransId: string;
}

export interface LogReminderFailedInput {
  loanAccountId: string;
  installmentId: string | null;
  triggerType: ReminderTriggerType;
  triggerDate: Date;
  phoneNumber: string;
  message: string;
  errorMessage: string;
}

export interface SmsReminderLogRow {
  id: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  phoneNumber: string;
  message: string;
  triggerType: ReminderTriggerType;
  triggerDate: Date;
  status: 'SENT' | 'DELIVERED' | 'UNDELIVERED' | 'REJECTED' | 'FAILED';
  providerTransId: string | null;
  errorMessage: string | null;
  sentAt: Date;
  deliveredAt: Date | null;
}

export interface ISmsReminderRepository {
  /**
   * One row per ACTIVE/ACTIVE_IN_ARREARS loan account whose NEXT not-fully-paid installment's
   * dueDate falls exactly on `targetDate` (calendar date, Asia/Manila) - used for the 4
   * date-anchored triggers (`targetDate` = today +/- the trigger's offset). Skips any Borrower
   * with smsRemindersEnabled=false and any loan whose borrower has no phone number on file.
   */
  findCandidatesDueOn(targetDate: Date, branchId: string | undefined): Promise<SmsReminderCandidate[]>;

  /**
   * One row per ACTIVE/ACTIVE_IN_ARREARS loan account with at least one overdue (dueDate < now)
   * and not-fully-paid installment - `PAST_DUE_WEEKLY`'s own candidate source. `daysLate` is
   * measured from the OLDEST overdue installment's dueDate (the arrears' own age); `totalAmountDue`
   * sums every overdue-and-unpaid installment's remaining principal+interest+fees+penalty - what
   * the borrower actually owes to become current, not the whole loan's remaining balance (which
   * would include not-yet-due future installments too).
   */
  findPastDueCandidates(branchId: string | undefined): Promise<SmsReminderCandidate[]>;

  /** True if a reminder was already logged for this exact (loan, trigger, calendar day) - the idempotency guard. */
  existsForTrigger(loanAccountId: string, triggerType: ReminderTriggerType, triggerDate: Date): Promise<boolean>;

  logSent(input: LogReminderSentInput): Promise<void>;
  logFailed(input: LogReminderFailedInput): Promise<void>;

  /** Applied by the M360 DLR webhook once the telco reports the real delivery outcome. */
  updateDeliveryStatus(providerTransId: string, status: 'DELIVERED' | 'UNDELIVERED' | 'REJECTED', deliveredAt: Date): Promise<void>;

  /** Reports Hub visibility (2026-07-18) - every logged reminder attempt, newest first. Unpaginated by design, matching the same "thousands, not 100,000+" volume acceptance as payment-reminder/dashboard. Optional `loanAccountId` scopes to one loan (Loan Detail page's Reminders panel). */
  listLogs(branchId: string | undefined, loanAccountId?: string): Promise<SmsReminderLogRow[]>;
}

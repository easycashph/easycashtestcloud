export interface SmsReminderCandidate {
  installmentId: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  /** Raw as stored on Borrower.mobilePhone1 - M360 accepts +639.../639.../09.../9... as-is, see M360SmsGateway's own doc comment. */
  phoneNumber: string;
  dueDate: Date;
  amountDueTotal: string;
}

export interface LogReminderSentInput {
  loanAccountId: string;
  installmentId: string;
  phoneNumber: string;
  message: string;
  providerTransId: string;
}

export interface LogReminderFailedInput {
  loanAccountId: string;
  installmentId: string;
  phoneNumber: string;
  message: string;
  errorMessage: string;
}

export interface ISmsReminderRepository {
  /**
   * One row per ACTIVE/ACTIVE_IN_ARREARS loan account whose NEXT not-fully-paid installment's
   * dueDate falls exactly on `targetDate` (calendar date, Asia/Manila) - mirrors
   * PrismaPaymentReminderRepository's "next due installment per loan" live computation, filtered
   * to one specific date instead of "any upcoming/overdue". Skips any Borrower with
   * smsRemindersEnabled=false and any loan whose borrower has no phone number on file.
   */
  findCandidatesDueOn(targetDate: Date, branchId: string | undefined): Promise<SmsReminderCandidate[]>;

  /** True if a reminder was already logged for this installment (any status) - the idempotency guard. */
  existsForInstallment(installmentId: string): Promise<boolean>;

  logSent(input: LogReminderSentInput): Promise<void>;
  logFailed(input: LogReminderFailedInput): Promise<void>;

  /** Applied by the M360 DLR webhook once the telco reports the real delivery outcome. */
  updateDeliveryStatus(providerTransId: string, status: 'DELIVERED' | 'UNDELIVERED' | 'REJECTED', deliveredAt: Date): Promise<void>;
}

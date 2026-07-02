export interface CreateRepaymentInstallmentInput {
  loanAccountId: string;
  installmentNumber: number;
  dueDate: Date;
  principalDue: string;
  interestDue?: string;
  feesDue?: string;
  penaltyDue?: string;
  legacyId?: string;
}

export interface RecordInstallmentPaymentInput {
  installmentId: string;
  principal?: string;
  interest?: string;
  fees?: string;
  penalty?: string;
  paidAt?: Date;
}

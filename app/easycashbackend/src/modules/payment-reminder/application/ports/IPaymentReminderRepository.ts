export interface InstallmentAmountsDto {
  principal: string;
  interest: string;
  fees: string;
  penalty: string;
  total: string;
}

export interface PaymentReminderCandidate {
  installmentId: string;
  loanAccountId: string;
  loanCode: string;
  branchId: string;
  borrowerName: string;
  installmentNumber: number;
  dueDate: Date;
  due: InstallmentAmountsDto;
  paid: InstallmentAmountsDto;
  /** Derived from dueDate vs now at query time — never the stale DB `status` cache (see PrismaPaymentReminderRepository doc comment). */
  status: 'PENDING' | 'PARTIALLY_PAID' | 'LATE';
  installmentsPaidCount: number;
  installmentsTotalCount: number;
}

export interface IPaymentReminderRepository {
  /**
   * One row per active loan account: its next not-fully-paid installment (upcoming or overdue).
   * A loan with every installment paid, or with no ACTIVE/ACTIVE_IN_ARREARS status, contributes
   * nothing here.
   */
  findNextDueInstallments(branchId: string | undefined): Promise<PaymentReminderCandidate[]>;
}

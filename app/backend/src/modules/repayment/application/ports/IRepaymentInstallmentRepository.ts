import type { TransactionContext } from '@shared/application/TransactionContext';
import type { RepaymentInstallment } from '../../domain/RepaymentInstallment';

export interface IRepaymentInstallmentRepository {
  findById(id: string, ctx?: TransactionContext): Promise<RepaymentInstallment | null>;
  /** Bounded by construction — an installment schedule per loan is at most in the low hundreds, unlike the ledger (ADR-042 §7/§11), so no pagination is required here. */
  findByLoanAccountId(loanAccountId: string, ctx?: TransactionContext): Promise<RepaymentInstallment[]>;
  save(installment: RepaymentInstallment, ctx?: TransactionContext): Promise<void>;
  saveMany(installments: RepaymentInstallment[], ctx?: TransactionContext): Promise<void>;
}

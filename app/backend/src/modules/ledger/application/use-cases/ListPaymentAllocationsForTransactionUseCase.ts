import { NotFoundError } from '@shared/errors/DomainError';
import type { IRepaymentInstallmentRepository } from '@modules/repayment/application/ports/IRepaymentInstallmentRepository';
import type { LoanTransaction } from '../../domain/LoanTransaction';
import type { PaymentAllocation } from '../../domain/PaymentAllocation';
import type { ILoanTransactionRepository } from '../ports/ILoanTransactionRepository';
import type { IPaymentAllocationRepository } from '../ports/IPaymentAllocationRepository';

export interface ListPaymentAllocationsForTransactionUseCaseDeps {
  loanTransactionRepository: ILoanTransactionRepository;
  paymentAllocationRepository: IPaymentAllocationRepository;
  repaymentInstallmentRepository: IRepaymentInstallmentRepository;
}

export interface AllocationWithInstallment {
  allocation: PaymentAllocation;
  /** Null when the allocation's installment no longer resolves (should not happen — FK is RESTRICT — but never trusted blindly). */
  installmentNumber: number | null;
  installmentDueDate: Date | null;
}

export interface ListPaymentAllocationsForTransactionResult {
  /** Returned so the controller can enforce branch scope (H-1) without a second fetch. */
  transaction: LoanTransaction;
  allocations: AllocationWithInstallment[];
}

/**
 * Read side of the `PaymentAllocation` rows `ProcessPaymentUseCase` has been writing since the
 * Reverse Payment feature (2026-07-11) — until now they were only ever read internally by
 * `ReversePaymentUseCase`. Exposing them lets the UI answer "which installment(s) did this
 * payment actually hit?" per transaction. Migrated/legacy REPAYMENTs predate allocation
 * recording and legitimately return an empty list, not an error.
 */
export class ListPaymentAllocationsForTransactionUseCase {
  constructor(private readonly deps: ListPaymentAllocationsForTransactionUseCaseDeps) {}

  async execute(transactionId: string): Promise<ListPaymentAllocationsForTransactionResult> {
    const transaction = await this.deps.loanTransactionRepository.findById(transactionId);
    if (!transaction) {
      throw new NotFoundError('LoanTransaction', transactionId);
    }

    const allocations = await this.deps.paymentAllocationRepository.findByLoanTransactionId(transactionId);
    if (allocations.length === 0) {
      return { transaction, allocations: [] };
    }

    const installments = await this.deps.repaymentInstallmentRepository.findByLoanAccountId(transaction.loanAccountId);
    const byId = new Map(installments.map((i) => [i.id, i]));

    return {
      transaction,
      allocations: allocations.map((allocation) => {
        const installment = byId.get(allocation.repaymentInstallmentId);
        return {
          allocation,
          installmentNumber: installment?.installmentNumber ?? null,
          installmentDueDate: installment?.dueDate ?? null,
        };
      }),
    };
  }
}

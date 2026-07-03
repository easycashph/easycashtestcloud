import { randomUUID } from 'node:crypto';
import type { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import { LoanBalances } from './valueObjects/LoanBalances';
import type { AppliedFee } from './AppliedFee';
import { InvalidStatusTransitionError } from './errors/LoanAccountDomainErrors';

export type LoanAccountStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'ACTIVE_IN_ARREARS'
  | 'CLOSED'
  | 'CLOSED_WRITTEN_OFF'
  | 'CLOSED_REJECTED';

export type RepaymentPeriodUnit = 'MONTHS';

/**
 * LA-2 / ADR-011: the full lean, legacy-observed lifecycle graph. Milestone
 * 7 only exposes `approve()`/`reject()` at the use-case layer (ADR-032:
 * approval and activation/disbursement are separate business events, and
 * activation requires the not-yet-built calculation engine) — but the
 * transition table itself models the whole lifecycle now, so it does not
 * need to be redesigned when later milestones add the remaining
 * transitions.
 */
const ALLOWED_TRANSITIONS: Record<LoanAccountStatus, LoanAccountStatus[]> = {
  PENDING_APPROVAL: ['APPROVED', 'CLOSED_REJECTED'],
  APPROVED: ['ACTIVE'],
  ACTIVE: ['ACTIVE_IN_ARREARS', 'CLOSED', 'CLOSED_WRITTEN_OFF'],
  ACTIVE_IN_ARREARS: ['ACTIVE', 'CLOSED', 'CLOSED_WRITTEN_OFF'],
  CLOSED: [],
  CLOSED_WRITTEN_OFF: [],
  CLOSED_REJECTED: [],
};

export interface LoanAccountProps {
  id: string;
  loanCode: string;
  borrowerId: string;
  loanProductVersionId: string;
  branchId: string;
  loanOfficerId?: string;
  status: LoanAccountStatus;
  principalAmount: Money;
  balances: LoanBalances;
  interestRate: Percentage;
  addOnInterestRate?: Percentage;
  contractualInterestRate?: Percentage;
  installmentCount: number;
  repaymentPeriodUnit: RepaymentPeriodUnit;
  gracePeriodDays: number;
  approvedAt?: Date;
  approvedByUserId?: string;
  activatedAt?: Date;
  closedAt?: Date;
  closedReason?: string;
  legacyId?: string;
  createdAt: Date;
  updatedAt: Date;
  appliedFees: AppliedFee[];
  coBorrowerIds: string[];
  /**
   * Milestone 9.1 checkpoint 5 / `docs/Architecture/ADR-optimistic-
   * concurrency.md`: read-only at this checkpoint — hydrated from the
   * persisted row, exposed via a getter, but not yet consulted or
   * incremented by any write path. The conditional `WHERE version = ?`
   * write and the increment-on-save behavior are checkpoint 6's scope.
   */
  version: number;
}

export interface CreateLoanAccountProps {
  loanCode: string;
  borrowerId: string;
  loanProductVersionId: string;
  branchId: string;
  loanOfficerId?: string;
  principalAmount: Money;
  interestRate: Percentage;
  addOnInterestRate?: Percentage;
  contractualInterestRate?: Percentage;
  installmentCount: number;
  repaymentPeriodUnit?: RepaymentPeriodUnit;
  gracePeriodDays?: number;
  legacyId?: string;
}

/**
 * Aggregate root (ADR-042 §5). Owns AppliedFee[] (small, bounded) and its
 * co-borrower attachments, but NOT LoanTransaction or RepaymentInstallment
 * — those are independent aggregates referenced by loanAccountId only.
 *
 * `interestRate`/`addOnInterestRate`/`contractualInterestRate` are a
 * snapshot taken at approval time (LA-4) — never recomputed from a later
 * LoanProductVersion edit. ADR-010 (Add-On vs. Contractual disclosure) is
 * open; this entity only stores the values, it never derives or discloses
 * them (FINANCIAL_INVARIANTS.md §8).
 */
export class LoanAccount {
  private constructor(private props: LoanAccountProps) {}

  static create(input: CreateLoanAccountProps): LoanAccount {
    const now = new Date();
    return new LoanAccount({
      id: randomUUID(),
      loanCode: input.loanCode,
      borrowerId: input.borrowerId,
      loanProductVersionId: input.loanProductVersionId,
      branchId: input.branchId,
      loanOfficerId: input.loanOfficerId,
      status: 'PENDING_APPROVAL',
      principalAmount: input.principalAmount,
      balances: LoanBalances.zero(),
      interestRate: input.interestRate,
      addOnInterestRate: input.addOnInterestRate,
      contractualInterestRate: input.contractualInterestRate,
      installmentCount: input.installmentCount,
      repaymentPeriodUnit: input.repaymentPeriodUnit ?? 'MONTHS',
      gracePeriodDays: input.gracePeriodDays ?? 0,
      legacyId: input.legacyId,
      createdAt: now,
      updatedAt: now,
      appliedFees: [],
      coBorrowerIds: [],
      version: 0,
    });
  }

  static reconstitute(props: LoanAccountProps): LoanAccount {
    return new LoanAccount(props);
  }

  get id(): string {
    return this.props.id;
  }

  get loanCode(): string {
    return this.props.loanCode;
  }

  get borrowerId(): string {
    return this.props.borrowerId;
  }

  get loanProductVersionId(): string {
    return this.props.loanProductVersionId;
  }

  get branchId(): string {
    return this.props.branchId;
  }

  get loanOfficerId(): string | undefined {
    return this.props.loanOfficerId;
  }

  get status(): LoanAccountStatus {
    return this.props.status;
  }

  get principalAmount(): Money {
    return this.props.principalAmount;
  }

  get balances(): LoanBalances {
    return this.props.balances;
  }

  get interestRate(): Percentage {
    return this.props.interestRate;
  }

  get addOnInterestRate(): Percentage | undefined {
    return this.props.addOnInterestRate;
  }

  get contractualInterestRate(): Percentage | undefined {
    return this.props.contractualInterestRate;
  }

  get installmentCount(): number {
    return this.props.installmentCount;
  }

  get repaymentPeriodUnit(): RepaymentPeriodUnit {
    return this.props.repaymentPeriodUnit;
  }

  get gracePeriodDays(): number {
    return this.props.gracePeriodDays;
  }

  get approvedAt(): Date | undefined {
    return this.props.approvedAt;
  }

  get approvedByUserId(): string | undefined {
    return this.props.approvedByUserId;
  }

  get activatedAt(): Date | undefined {
    return this.props.activatedAt;
  }

  get closedAt(): Date | undefined {
    return this.props.closedAt;
  }

  get closedReason(): string | undefined {
    return this.props.closedReason;
  }

  get legacyId(): string | undefined {
    return this.props.legacyId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get appliedFees(): readonly AppliedFee[] {
    return this.props.appliedFees;
  }

  get coBorrowerIds(): readonly string[] {
    return this.props.coBorrowerIds;
  }

  get version(): number {
    return this.props.version;
  }

  private transitionTo(next: LoanAccountStatus): void {
    const allowed = ALLOWED_TRANSITIONS[this.props.status];
    if (!allowed.includes(next)) {
      throw new InvalidStatusTransitionError(this.props.status, next);
    }
    this.props.status = next;
    this.props.updatedAt = new Date();
  }

  /**
   * ADR-032: approval only — this is deliberately NOT disbursement/
   * activation. No LoanTransaction, no RepaymentInstallment generation, no
   * balance change happens here (those require the not-yet-built
   * calculation engine and belong to a later ActivateLoanUseCase).
   */
  approve(approvedByUserId: string): void {
    this.transitionTo('APPROVED');
    this.props.approvedAt = new Date();
    this.props.approvedByUserId = approvedByUserId;
  }

  reject(reason?: string): void {
    this.transitionTo('CLOSED_REJECTED');
    this.props.closedAt = new Date();
    this.props.closedReason = reason;
  }

  addAppliedFee(fee: AppliedFee): void {
    this.props.appliedFees.push(fee);
    this.props.updatedAt = new Date();
  }

  attachCoBorrower(coBorrowerId: string): void {
    if (!this.props.coBorrowerIds.includes(coBorrowerId)) {
      this.props.coBorrowerIds.push(coBorrowerId);
      this.props.updatedAt = new Date();
    }
  }

  detachCoBorrower(coBorrowerId: string): void {
    this.props.coBorrowerIds = this.props.coBorrowerIds.filter((id) => id !== coBorrowerId);
    this.props.updatedAt = new Date();
  }
}

import { randomUUID } from 'node:crypto';
import { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import type { TransactionComponents } from '@modules/ledger/domain/valueObjects/TransactionComponents';
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
  /**
   * ADR-045 (Concept 1 — Exact First Repayment Date): an explicit input
   * supplied at origination, never computed/derived from disbursement
   * date or any other field — no recoverable generation rule exists in
   * this system's evidence base. Used by `ActivateLoanUseCase` (CP8) as
   * the anchor date for `RepaymentInstallment` schedule generation;
   * subsequent installments are spaced from this date by
   * `repaymentPeriodUnit`. This entity only stores the value — it does
   * not generate the schedule itself.
   */
  firstRepaymentDate: Date;
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
   * Milestone 9.1 checkpoint 5/6 / `docs/Architecture/ADR-optimistic-
   * concurrency.md`: hydrated from the persisted row on read. As of
   * checkpoint 6, `PrismaLoanAccountRepository.save()` uses this value as
   * the `WHERE version = ?` guard on a conditional UPDATE, and increments
   * it (`version + 1`) as part of that same write.
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
  firstRepaymentDate: Date;
  legacyId?: string;
}

/**
 * Milestone 9.1 checkpoint 7: the already-decided totals `activate()` needs
 * to populate the twelve balance columns with. Deliberately does NOT
 * compute these itself — running `AmortizationScheduleGenerator` (CP3) and
 * deciding how `AppliedFee` rows contribute to `feesDue` are the
 * (not-yet-built) `ActivateLoanUseCase`'s job (CP8), not this entity's.
 * `penaltyDue`/`feesDue` default to zero: a loan has no penalty at the
 * moment of activation by definition (penalty accrues from lateness, which
 * cannot exist yet), and a loan may legitimately have no fees.
 */
export interface ActivateLoanAccountInput {
  principalDue: Money;
  interestDue: Money;
  feesDue?: Money;
  penaltyDue?: Money;
  activatedAt?: Date;
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
  private constructor(
    private props: LoanAccountProps,
    private readonly isNewRecord: boolean,
  ) {}

  static create(input: CreateLoanAccountProps): LoanAccount {
    const now = new Date();
    return new LoanAccount(
      {
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
        firstRepaymentDate: input.firstRepaymentDate,
        legacyId: input.legacyId,
        createdAt: now,
        updatedAt: now,
        appliedFees: [],
        coBorrowerIds: [],
        version: 0,
      },
      true,
    );
  }

  static reconstitute(props: LoanAccountProps): LoanAccount {
    return new LoanAccount(props, false);
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

  /**
   * Milestone 9.1 checkpoint 11 / `ADR-007-outstanding-balance-formula.md`
   * §3 (RESOLVED, Option B): penalty-inclusive summary total, matching the
   * legacy ledger's `loan_transactions.balance` running total and the
   * `Daily Collection Report.xlsx` "Total Balance" concept. Computed on
   * demand from the twelve existing balance columns — no stored column, by
   * design (§1: balance is a maintained running total per component, never
   * independently re-derived by summing transaction history, but a
   * *summary* of the current, already-maintained components is exactly
   * that: a sum of already-correct numbers, not a re-derivation of them).
   *
   * Deliberately NOT named `outstandingBalance` — that generic name is the
   * exact ambiguity `ADR-007` §3 resolved by requiring two distinctly-named
   * fields instead.
   */
  get collectionsBalance(): Money {
    const balances = this.props.balances;
    return balances.principalBalance.add(balances.interestBalance).add(balances.feesBalance).add(balances.penaltyBalance);
  }

  /**
   * `ADR-007-outstanding-balance-formula.md` §3 (RESOLVED, Option B):
   * penalty-EXCLUSIVE summary total, matching the `Accounting-Detailed
   * Ending Current Balance.xlsx` "Total Obligation" concept. Same
   * computed-on-demand basis as `collectionsBalance` — no stored column.
   */
  get accountingBalance(): Money {
    const balances = this.props.balances;
    return balances.principalBalance.add(balances.interestBalance).add(balances.feesBalance);
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

  get firstRepaymentDate(): Date {
    return this.props.firstRepaymentDate;
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

  /**
   * Milestone 9.1 checkpoint 6: true only for an aggregate built via
   * `create()` and never yet persisted. Lets the repository choose an
   * INSERT vs. a conditional `WHERE version = ?` UPDATE without an extra
   * existence-checking read. Transient repository-routing state, not part
   * of `LoanAccountProps` — it is never a persisted column.
   */
  get isNew(): boolean {
    return this.isNewRecord;
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

  /**
   * Milestone 9.1 checkpoint 7 / ADR-032: activation is disbursement — the
   * calculation engine's already-computed schedule totals (`input`) become
   * this loan's Due and Balance figures; nothing is paid yet. This method
   * performs ONLY the mechanical status transition (reusing `transitionTo`,
   * exactly as `approve()`/`reject()` already do — no separate Policy
   * class, per Decision Log #14) plus the balance-field assignment. It does
   * NOT decide what `input`'s totals should be — that decision (running
   * `AmortizationScheduleGenerator`, summing `AppliedFee` rows) belongs to
   * `ActivateLoanUseCase` (CP8), which has not been built yet.
   *
   * `FINANCIAL_INVARIANTS.md §3`: a `LoanAccount` balance field may only be
   * written as the derived effect of a `LoanTransaction` insert, in the
   * same database transaction. This entity has no ledger access and cannot
   * enforce that itself — the caller (CP8's use case) is responsible for
   * inserting the corresponding `DISBURSEMENT` `LoanTransaction` in the
   * same `IUnitOfWork.run()` block as the `save()` that persists this
   * call's effect.
   */
  activate(input: ActivateLoanAccountInput): void {
    this.transitionTo('ACTIVE');
    this.props.activatedAt = input.activatedAt ?? new Date();

    const feesDue = input.feesDue ?? Money.ZERO;
    const penaltyDue = input.penaltyDue ?? Money.ZERO;

    this.props.balances = LoanBalances.of({
      principalBalance: input.principalDue,
      principalPaid: Money.ZERO,
      principalDue: input.principalDue,
      interestBalance: input.interestDue,
      interestPaid: Money.ZERO,
      interestDue: input.interestDue,
      feesBalance: feesDue,
      feesPaid: Money.ZERO,
      feesDue,
      penaltyBalance: penaltyDue,
      penaltyPaid: Money.ZERO,
      penaltyDue,
    });
  }

  /**
   * Milestone 9.1 checkpoint 7 / ADR-009: applies an already-decided
   * principal/interest/fees/penalty split to this loan's balances. Reuses
   * `TransactionComponents` — the `ledger` module's existing VO (Decision
   * Log #13) — rather than inventing a new balance-effect shape. Deciding
   * HOW a payment splits across those four components (and, when it spans
   * multiple installments, across which ones) is the
   * `PaymentAllocationService`'s job (CP4, already built) and
   * `ProcessPaymentUseCase`'s job (CP9, not yet built) — this is the
   * mechanical primitive CP9 will call once it has that split, mirroring
   * `RepaymentInstallment.recordPayment()`'s identical precedent.
   *
   * `*Due` fields are untouched — they are fixed at activation and only
   * `*Balance`/`*Paid` move here. A resulting negative balance (overpayment)
   * is a valid state, not rejected — see `Money.ts`'s own documented
   * semantics and `FINANCIAL_INVARIANTS.md §3`; CALC-SPEC's overpayment
   * *mechanism* is explicitly `STATUS: UNRESOLVED`, so no disposition for
   * it is invented here.
   *
   * Same `FINANCIAL_INVARIANTS.md §3` caller obligation as `activate()`:
   * the corresponding `LoanTransaction` insert must happen in the same
   * `IUnitOfWork.run()` block as the `save()` that persists this call's
   * effect — this entity cannot enforce that itself.
   */
  applyPayment(components: TransactionComponents, paidAt: Date = new Date()): void {
    const balances = this.props.balances;
    this.props.balances = LoanBalances.of({
      principalBalance: balances.principalBalance.subtract(components.principalComponent),
      principalPaid: balances.principalPaid.add(components.principalComponent),
      principalDue: balances.principalDue,
      interestBalance: balances.interestBalance.subtract(components.interestComponent),
      interestPaid: balances.interestPaid.add(components.interestComponent),
      interestDue: balances.interestDue,
      feesBalance: balances.feesBalance.subtract(components.feesComponent),
      feesPaid: balances.feesPaid.add(components.feesComponent),
      feesDue: balances.feesDue,
      penaltyBalance: balances.penaltyBalance.subtract(components.penaltyComponent),
      penaltyPaid: balances.penaltyPaid.add(components.penaltyComponent),
      penaltyDue: balances.penaltyDue,
    });
    this.props.updatedAt = paidAt;
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

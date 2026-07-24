import { randomUUID } from 'node:crypto';
import { Money } from '@shared/domain/Money';
import type { Percentage } from '@shared/domain/Percentage';
import type { TransactionComponents } from '@modules/ledger/domain/valueObjects/TransactionComponents';
import { LoanBalances } from './valueObjects/LoanBalances';
import { OriginationFees, type OriginationFeesProps } from './valueObjects/OriginationFees';
import type { AppliedFee } from './AppliedFee';
import { InvalidStatusTransitionError, LoanAccountNotEditableError } from './errors/LoanAccountDomainErrors';

export type LoanAccountStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'ACTIVE'
  | 'ACTIVE_IN_ARREARS'
  | 'CLOSED'
  | 'CLOSED_WRITTEN_OFF'
  | 'CLOSED_REJECTED'
  | 'CLOSED_RESTRUCTURED';

export type RepaymentPeriodUnit = 'MONTHS';

/**
 * LA-2 / ADR-011: the full lean, legacy-observed lifecycle graph. Milestone
 * 7 only exposes `approve()`/`reject()` at the use-case layer (ADR-032:
 * approval and activation/disbursement are separate business events, and
 * activation requires the not-yet-built calculation engine) — but the
 * transition table itself models the whole lifecycle now, so it does not
 * need to be redesigned when later milestones add the remaining
 * transitions.
 *
 * 2026-07-16: `CLOSED -> ACTIVE` added for `reopen()` — a `ReversePaymentUseCase` call that undoes
 * the exact payment which had closed the loan (e.g. a cashier's wrong-amount entry) must be able to
 * bring the loan back, otherwise a loan sits CLOSED with a nonzero real balance forever. Only from
 * `CLOSED`, not `CLOSED_WRITTEN_OFF`/`CLOSED_REJECTED` — reversing a payment on an already
 * written-off or rejected loan is a different, not-yet-scoped business decision.
 *
 * 2026-07-16 (Undo Approve / Undo Activate, user request, MIS-only): `APPROVED -> PENDING_APPROVAL`
 * (`undoApprove()`) and `ACTIVE -> APPROVED` (`undoActivate()`) — both safety nets for an
 * accidental click, not general-purpose reversals. `undoApprove()` is unconditionally safe (nothing
 * financial has happened yet at APPROVED). `undoActivate()` is guarded at the use-case layer
 * (`UndoActivateLoanUseCase`) against a loan that already has a recorded payment or a penalty/fee
 * override — see `LoanAccountHasActivityError`'s own doc comment.
 *
 * 2026-07-24 (Loan Restructure feature, user-confirmed): `ACTIVE`/`ACTIVE_IN_ARREARS ->
 * CLOSED_RESTRUCTURED`, mirroring `CLOSED_WRITTEN_OFF`'s identical shape (reachable from either,
 * no outbound transitions of its own — a restructured loan's balance moved to a brand new
 * LoanAccount, it never comes back to life the way `CLOSED` can via `reopen()`).
 */
const ALLOWED_TRANSITIONS: Record<LoanAccountStatus, LoanAccountStatus[]> = {
  PENDING_APPROVAL: ['APPROVED', 'CLOSED_REJECTED'],
  APPROVED: ['ACTIVE', 'PENDING_APPROVAL'],
  ACTIVE: ['ACTIVE_IN_ARREARS', 'CLOSED', 'CLOSED_WRITTEN_OFF', 'CLOSED_RESTRUCTURED', 'APPROVED'],
  ACTIVE_IN_ARREARS: ['ACTIVE', 'CLOSED', 'CLOSED_WRITTEN_OFF', 'CLOSED_RESTRUCTURED'],
  // CLOSED -> ACTIVE only: `reopen()` (Reverse Payment feature) needs it when reversing the
  // payment that auto-closed this loan leaves it no longer fully paid. Never reachable from
  // CLOSED_WRITTEN_OFF/CLOSED_REJECTED/CLOSED_RESTRUCTURED - those aren't "fully paid" closures
  // to begin with.
  CLOSED: ['ACTIVE'],
  CLOSED_WRITTEN_OFF: [],
  CLOSED_REJECTED: [],
  CLOSED_RESTRUCTURED: [],
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
  /**
   * 2026-07-14: staff-entered estimate captured at loan account creation, used to compute the
   * Advance Interest Fee (ADR-046) and reused as the `{AnticipatedDisbursementDate}` merge field
   * on generated loan documents (ADR-051) — distinct from `activatedAt`, the real disbursement
   * date, which has no value yet when documents are generated at APPROVED.
   */
  anticipatedDisbursementDate?: Date;
  approvedAt?: Date;
  approvedByUserId?: string;
  activatedAt?: Date;
  closedAt?: Date;
  closedReason?: string;
  /**
   * CP12 migration follow-up (2026-07-09): true when this loan's legacy record had no
   * account-level balance snapshot at all, so every `balances` field was migrated as 0.00 for
   * lack of any other value — never set by `create()`/`activate()` for a loan originated through
   * this system itself, which always populates real balances. Read-only from the application's
   * perspective; only ever set via the one-time backfill script.
   */
  legacyBalanceDataMissing: boolean;
  /**
   * ADR-007 §4 (2026-07-08 decision): true for one of the 79 legacy `CLOSED` loans whose migrated
   * balance columns don't sum to zero despite being marked fully settled — migrated as-is, flagged
   * for manual accounting review rather than a fabricated correction. Same read-only,
   * backfill-script-only posture as `legacyBalanceDataMissing` above.
   */
  legacyNonReconcilingClosedBalance: boolean;
  /**
   * 2026-07-16: the LoanApplication this account was actually created from, if any — see the
   * Prisma schema field's own doc comment for why this replaced a "borrower's most recent loan
   * account" heuristic in `loanApplicationController.buildLinkage()`. Undefined for a loan
   * created without going through an application (legacy migration, or Create Loan Account used
   * standalone rather than from an application's Approved state).
   */
  sourceApplicationId?: string;
  /** 2026-07-11 (Create Loan Account) — see `OriginationFees`'s own doc comment. */
  originationFees: OriginationFees;
  /** = principalAmount - originationFees.total(). Computed once at creation (LA-4 snapshot), never recomputed. */
  netProceeds: Money;
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
  anticipatedDisbursementDate?: Date;
  /** 2026-07-16 — see `LoanAccountProps.sourceApplicationId`'s own doc comment. */
  sourceApplicationId?: string;
  /** 2026-07-11 (Create Loan Account) — omit for zero fees (e.g. programmatic/migration creation). */
  originationFees?: OriginationFeesProps;
  legacyId?: string;
}

/**
 * 2026-07-16 (Edit Loan Account) — every field `update()` may change, all optional (a caller
 * supplies only what the staff member actually edited). Deliberately the same set `create()`
 * accepts, minus `loanCode`/`borrowerId`/`branchId`/`loanOfficerId`/`legacyId`/
 * `sourceApplicationId` — identity/ownership/linkage fields, not origination terms, so out of
 * scope for "I typed the wrong term/amount."
 */
export interface UpdateLoanAccountProps {
  loanProductVersionId?: string;
  principalAmount?: Money;
  interestRate?: Percentage;
  addOnInterestRate?: Percentage;
  contractualInterestRate?: Percentage;
  installmentCount?: number;
  repaymentPeriodUnit?: RepaymentPeriodUnit;
  gracePeriodDays?: number;
  firstRepaymentDate?: Date;
  anticipatedDisbursementDate?: Date;
  originationFees?: OriginationFeesProps;
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
    const originationFees = OriginationFees.of(input.originationFees ?? OriginationFees.zero().toProps());
    const netProceeds = input.principalAmount.subtract(originationFees.total());
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
        anticipatedDisbursementDate: input.anticipatedDisbursementDate,
        legacyBalanceDataMissing: false,
        legacyNonReconcilingClosedBalance: false,
        sourceApplicationId: input.sourceApplicationId,
        originationFees,
        netProceeds,
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

  get anticipatedDisbursementDate(): Date | undefined {
    return this.props.anticipatedDisbursementDate;
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

  get sourceApplicationId(): string | undefined {
    return this.props.sourceApplicationId;
  }

  get legacyBalanceDataMissing(): boolean {
    return this.props.legacyBalanceDataMissing;
  }

  get legacyNonReconcilingClosedBalance(): boolean {
    return this.props.legacyNonReconcilingClosedBalance;
  }

  get originationFees(): OriginationFees {
    return this.props.originationFees;
  }

  get netProceeds(): Money {
    return this.props.netProceeds;
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
   * 2026-07-16 (Undo Approve, user request, MIS-only): undoes `approve()` — nothing financial has
   * happened yet at APPROVED (see `approve()`'s own doc comment: "no LoanTransaction, no
   * RepaymentInstallment generation, no balance change"), so this is unconditionally safe,
   * mechanical only, no use-case-level guard needed (unlike `undoActivate()` below).
   */
  undoApprove(): void {
    this.transitionTo('PENDING_APPROVAL');
    this.props.approvedAt = undefined;
    this.props.approvedByUserId = undefined;
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
   * 2026-07-16 (Undo Activate, user request, MIS-only): undoes `activate()` — transitions back to
   * APPROVED, clears `activatedAt`, and resets balances to zero (mirroring `create()`'s own
   * pre-activation state). Deliberately does NOT touch the `DISBURSEMENT` `LoanTransaction` the
   * original `activate()` call inserted — `ILoanTransactionRepository` has no delete method at all
   * (TXN-1: append-only, enforced at the type level), and user-confirmed scope keeps it that way:
   * that transaction stays in Payment History as a factual record ("activation was attempted at
   * this timestamp"), superseded rather than erased once the loan is corrected and activated
   * again. The use-case layer (`UndoActivateLoanUseCase`) is responsible for also deleting this
   * loan's `RepaymentInstallment` rows (not under the same append-only rule) and for refusing the
   * whole operation up front if a real payment or penalty/fee override already exists — this
   * entity has no ledger/installment access and cannot check either itself.
   */
  undoActivate(): void {
    this.transitionTo('APPROVED');
    this.props.activatedAt = undefined;
    this.props.balances = LoanBalances.zero();
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

  /**
   * 2026-07-16 (Adjust Fees follow-up fix): keeps `feesBalance`/`feesDue` in sync with a
   * `RepaymentInstallment.adjustFees()` override — otherwise the loan-level summary balances
   * (`accountingBalance`/`collectionsBalance`) silently drift from what the Repayment Schedule
   * tab shows, since `AdjustFeesUseCase` mutates the installment but this entity is a separate
   * aggregate. `due.fees` is a frozen (non-live-computed) figure — a straight delta is safe here.
   *
   * `delta` is `previousFeesAmount - newFeesAmount` (positive when the fee was lowered, negative
   * when raised) — mirrors `applyPayment()`'s same caller obligation: the corresponding
   * `PenaltyReduction`/`FeeAdjustment` audit row insert must happen in the same `IUnitOfWork.run()`
   * block as the `save()` that persists this call's effect.
   */
  adjustFeesBalance(delta: Money, adjustedAt: Date = new Date()): void {
    const balances = this.props.balances;
    this.props.balances = LoanBalances.of({
      ...balances.toProps(),
      feesBalance: balances.feesBalance.subtract(delta),
      feesDue: balances.feesDue.subtract(delta),
    });
    this.props.updatedAt = adjustedAt;
  }

  /**
   * 2026-07-16 (Reduce Penalty follow-up, requested after `adjustFeesBalance` above shipped):
   * same shape, same caller obligation — but `delta` MUST be computed against
   * `resolveEffectivePenaltyDue()` (override-or-`due.penalty`), never `resolveComputedPenalty()`'s
   * live ADR-050 projection. `penaltyBalance`/`penaltyDue` were seeded from `due.penalty` at
   * activation and have never once been incremented by the live daily-accrual formula — syncing
   * against that live figure would subtract an amount this balance never actually contained,
   * producing a wrong number instead of a corrected one (this is exactly why this method was
   * deferred when `adjustFeesBalance` first shipped). `due.penalty` itself IS safe to sync against
   * because it's frozen the same way `due.fees` is — only the ADR-050 *projection* is live.
   */
  adjustPenaltyBalance(delta: Money, adjustedAt: Date = new Date()): void {
    const balances = this.props.balances;
    this.props.balances = LoanBalances.of({
      ...balances.toProps(),
      penaltyBalance: balances.penaltyBalance.subtract(delta),
      penaltyDue: balances.penaltyDue.subtract(delta),
    });
    this.props.updatedAt = adjustedAt;
  }

  /**
   * True once every balance component (principal/interest/fees/penalty) has been paid down to
   * zero or better (an overpayment/credit still counts as "fully paid" — `FINANCIAL_INVARIANTS.md
   * §3` allows a negative balance and this isn't the place to invent a disposition for it).
   * Used by `ProcessPaymentUseCase` to decide whether a payment just settled the loan.
   */
  get isFullyPaid(): boolean {
    return !this.props.balances.principalBalance.isPositive()
      && !this.props.balances.interestBalance.isPositive()
      && !this.props.balances.feesBalance.isPositive()
      && !this.props.balances.penaltyBalance.isPositive();
  }

  /**
   * Marks a fully-paid ACTIVE/ACTIVE_IN_ARREARS loan CLOSED. Mechanical transition only, mirroring
   * `approve()`/`reject()` — callers (`ProcessPaymentUseCase`) decide *when* to call this, via
   * `isFullyPaid`.
   */
  close(): void {
    this.transitionTo('CLOSED');
    this.props.closedAt = new Date();
  }

  /**
   * 2026-07-24 (Loan Restructure feature, user-confirmed): marks a past-due/matured ACTIVE or
   * ACTIVE_IN_ARREARS loan CLOSED_RESTRUCTURED — mechanical transition only, mirroring `close()`/
   * `reject()`. The use-case layer (`RestructureLoanUseCase`) decides eligibility (past due or
   * matured, not already restructured) and creates the new `LoanAccount` + `LoanRestructure`
   * audit row; this entity has no schedule/audit-trail access and cannot check either itself.
   * Balances are deliberately left untouched (frozen as of the moment of restructure) — the old
   * loan's remaining balance moved to a new account, it was neither collected nor written off.
   */
  restructureClose(): void {
    this.transitionTo('CLOSED_RESTRUCTURED');
    this.props.closedAt = new Date();
    this.props.closedReason = 'Restructured';
  }

  /**
   * 2026-07-16 (Reverse Payment follow-up fix): undoes `close()` — brings a `CLOSED` loan back to
   * `ACTIVE` and clears `closedAt`/`closedReason`, since neither is true anymore. Mechanical
   * transition only, mirroring `close()`; the caller (`ReversePaymentUseCase`) decides *when* to
   * call this, via `!isFullyPaid` after the reversal has been applied. Always reopens to `ACTIVE`,
   * never `ACTIVE_IN_ARREARS` — this codebase does not track which of the two a loan was in before
   * `close()` was called, and arrears classification is already computed live elsewhere (Loan
   * Portfolio Health) rather than trusted from this stored column.
   */
  reopen(): void {
    this.transitionTo('ACTIVE');
    this.props.closedAt = undefined;
    this.props.closedReason = undefined;
  }

  /**
   * 2026-07-16 (Edit Loan Account, user request) — see `LoanAccountNotEditableError`'s own doc
   * comment for why this is refused once the loan is past `PENDING_APPROVAL`. Every field is
   * optional (partial update — only what the caller actually supplied changes); `netProceeds` is
   * recomputed whenever either `principalAmount` or `originationFees` changes, mirroring
   * `create()`'s own derivation, so it never silently goes stale relative to the edited values.
   * `LoanProductVersion` range validation (loanAmountMin/Max, installmentCountMin/Max) is the
   * caller's job (`UpdateLoanAccountUseCase`), exactly as it already is for `create()` — this
   * entity has no product-version lookup of its own.
   */
  update(input: UpdateLoanAccountProps): void {
    if (this.props.status !== 'PENDING_APPROVAL') {
      throw new LoanAccountNotEditableError(this.props.status);
    }

    if (input.loanProductVersionId !== undefined) {
      this.props.loanProductVersionId = input.loanProductVersionId;
    }
    if (input.principalAmount !== undefined) {
      this.props.principalAmount = input.principalAmount;
    }
    if (input.interestRate !== undefined) {
      this.props.interestRate = input.interestRate;
    }
    if (input.addOnInterestRate !== undefined) {
      this.props.addOnInterestRate = input.addOnInterestRate;
    }
    if (input.contractualInterestRate !== undefined) {
      this.props.contractualInterestRate = input.contractualInterestRate;
    }
    if (input.installmentCount !== undefined) {
      this.props.installmentCount = input.installmentCount;
    }
    if (input.repaymentPeriodUnit !== undefined) {
      this.props.repaymentPeriodUnit = input.repaymentPeriodUnit;
    }
    if (input.gracePeriodDays !== undefined) {
      this.props.gracePeriodDays = input.gracePeriodDays;
    }
    if (input.firstRepaymentDate !== undefined) {
      this.props.firstRepaymentDate = input.firstRepaymentDate;
    }
    if (input.anticipatedDisbursementDate !== undefined) {
      this.props.anticipatedDisbursementDate = input.anticipatedDisbursementDate;
    }
    if (input.originationFees !== undefined) {
      this.props.originationFees = OriginationFees.of(input.originationFees);
    }
    if (input.principalAmount !== undefined || input.originationFees !== undefined) {
      this.props.netProceeds = this.props.principalAmount.subtract(this.props.originationFees.total());
    }

    this.props.updatedAt = new Date();
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

import { randomUUID } from 'node:crypto';
import type { Money } from '@shared/domain/Money';
import { InstallmentAmounts } from './valueObjects/InstallmentAmounts';
import {
  FeesAlreadyPaidError,
  InvalidFeesAdjustmentAmountError,
  PenaltyAlreadyPaidError,
  PenaltyReductionExceedsCurrentAmountError,
} from './errors/RepaymentDomainErrors';

export type RepaymentInstallmentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'LATE';

/** 2026-07-15 (Reduce Penalty feature) — see `RepaymentInstallment.reducePenalty()`'s own doc comment. */
export interface PenaltyOverride {
  amount: Money;
  reason: string;
  byUserId: string;
  /** Display-only, read-path convenience (never set by `reducePenalty()` itself — that's a pure write with no user-name lookup) — populated by the repository's `findById`/`findByLoanAccountId` reads for the presenter to surface "Reduced by X" without a second query. `undefined` when not hydrated (e.g. a freshly-constructed entity before its first save). */
  byName?: string;
  at: Date;
}

/** 2026-07-16 (Adjust Fees feature) — see `RepaymentInstallment.adjustFees()`'s own doc comment. Same shape as `PenaltyOverride`. */
export interface FeesOverride {
  amount: Money;
  reason: string;
  byUserId: string;
  /** Display-only, read-path convenience — see `PenaltyOverride.byName`'s own doc comment. */
  byName?: string;
  at: Date;
}

export interface RepaymentInstallmentProps {
  id: string;
  loanAccountId: string;
  installmentNumber: number;
  dueDate: Date;
  due: InstallmentAmounts;
  paid: InstallmentAmounts;
  lastPaidAt?: Date;
  penaltyOverride?: PenaltyOverride;
  feesOverride?: FeesOverride;
  legacyId?: string;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Milestone 9.1 checkpoint 5/6 / `docs/Architecture/ADR-optimistic-
   * concurrency.md` — see the identical note on `LoanAccountProps.version`
   * (`modules/loan-account/domain/LoanAccount.ts`) for the full rationale.
   */
  version: number;
}

export interface CreateRepaymentInstallmentProps {
  loanAccountId: string;
  installmentNumber: number;
  dueDate: Date;
  due: InstallmentAmounts;
  legacyId?: string;
}

/**
 * Independent aggregate root (ADR-042 §7) — one instance per installment
 * row, NOT a child of a "RepaymentSchedule" aggregate. See ADR-042 §7 for
 * the full justification: the one cross-installment invariant (sum of
 * `due` amounts equals the loan's totals) is guaranteed at batch-creation
 * time by whatever generates a full schedule at once, not by an ongoing
 * shared consistency boundary — `due` fields are immutable after
 * construction on this entity (only `paid`/`status` change over the
 * installment's life).
 *
 * `status` is a derived getter (REPAY-3: "status must be derivable from
 * due/paid amounts and due date"), never independently settable — there is
 * no `setStatus()` anywhere on this class.
 */
export class RepaymentInstallment {
  private props: RepaymentInstallmentProps;
  private readonly isNewRecord: boolean;

  private constructor(props: RepaymentInstallmentProps, isNewRecord: boolean) {
    this.props = props;
    this.isNewRecord = isNewRecord;
  }

  static create(input: CreateRepaymentInstallmentProps): RepaymentInstallment {
    const now = new Date();
    return new RepaymentInstallment(
      {
        id: randomUUID(),
        loanAccountId: input.loanAccountId,
        installmentNumber: input.installmentNumber,
        dueDate: input.dueDate,
        due: input.due,
        paid: InstallmentAmounts.of({}),
        legacyId: input.legacyId,
        createdAt: now,
        updatedAt: now,
        version: 0,
      },
      true,
    );
  }

  static reconstitute(props: RepaymentInstallmentProps): RepaymentInstallment {
    return new RepaymentInstallment(props, false);
  }

  get id(): string {
    return this.props.id;
  }

  get loanAccountId(): string {
    return this.props.loanAccountId;
  }

  get installmentNumber(): number {
    return this.props.installmentNumber;
  }

  get dueDate(): Date {
    return this.props.dueDate;
  }

  get due(): InstallmentAmounts {
    return this.props.due;
  }

  get paid(): InstallmentAmounts {
    return this.props.paid;
  }

  get lastPaidAt(): Date | undefined {
    return this.props.lastPaidAt;
  }

  get penaltyOverride(): PenaltyOverride | undefined {
    return this.props.penaltyOverride;
  }

  get feesOverride(): FeesOverride | undefined {
    return this.props.feesOverride;
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

  get version(): number {
    return this.props.version;
  }

  /**
   * Milestone 9.1 checkpoint 6: true only for an aggregate built via
   * `create()` and never yet persisted — see the identical note on
   * `LoanAccount.isNew` (`modules/loan-account/domain/LoanAccount.ts`) for
   * the full rationale.
   */
  get isNew(): boolean {
    return this.isNewRecord;
  }

  /**
   * 2026-07-16 (status-vs-override fix): the same "chargeable" amount `ProcessPaymentUseCase`'s
   * allocation engine and `resolveEffectivePenaltyDue` use — an explicit override wins, otherwise
   * the frozen `due` figure. Deliberately NOT the live ADR-050 projection (`resolveComputedPenalty`)
   * — a status that flips PAID/LATE as a live daily formula ticks upward, for an installment nobody
   * has touched since it was settled, would be nonsensical. Kept local (not imported from
   * `CurrentPenaltyResolver`) to avoid a circular import — that module already imports this class's
   * type.
   */
  private get effectiveDueTotal(): Money {
    return this.props.due.principal
      .add(this.props.due.interest)
      .add(this.effectiveFeesDue)
      .add(this.props.penaltyOverride?.amount ?? this.props.due.penalty);
  }

  /**
   * REPAY-3, derived — never stored/settable directly.
   *
   * ASSUMPTION (not verified against legacy data — flag for confirmation
   * before this precedence is relied on by a real collections/aging
   * report): an overdue installment is reported LATE even if it has a
   * partial payment, i.e. LATE takes precedence over PARTIALLY_PAID once
   * the due date has passed. PROJECT_RULES.md does not specify this
   * precedence explicitly.
   *
   * 2026-07-16: compares against `effectiveDueTotal` (override-aware), not raw `due.total()` — a
   * Reduce Penalty or Adjust Fees override permanently lowers what "fully paid" means for this
   * installment; comparing against the stale original total left a fully-settled installment stuck
   * at LATE forever (found via a real client loan, `SML-REG_00210` installment #3).
   */
  get status(): RepaymentInstallmentStatus {
    const totalDue = this.effectiveDueTotal;
    const totalPaid = this.props.paid.total();

    if (totalPaid.greaterThan(totalDue) || totalPaid.equals(totalDue)) {
      return 'PAID';
    }
    if (this.props.dueDate.getTime() < Date.now()) {
      return 'LATE';
    }
    if (totalPaid.isPositive()) {
      return 'PARTIALLY_PAID';
    }
    return 'PENDING';
  }

  /**
   * Applies an already-decided payment split to THIS installment only —
   * deciding how much of a payment goes to which installment among
   * several is the (not-yet-built, ADR-009-gated) payment allocation
   * algorithm's job, not this method's. This is the mechanical primitive
   * that algorithm will call once it exists.
   */
  recordPayment(amount: InstallmentAmounts, paidAt: Date = new Date()): void {
    this.props.paid = this.props.paid.add(amount);
    this.props.lastPaidAt = paidAt;
    this.props.updatedAt = new Date();
  }

  /**
   * 2026-07-15 (Reduce Penalty feature, user-confirmed business rules):
   * - Accounting/MIS can partially or fully reduce this installment's penalty.
   * - A reduction FREEZES the penalty at `newAmount` — it stops growing per ADR-050's live daily
   *   formula from this point on, until paid or reduced again. This is why the override is stored
   *   here rather than applied as a one-time subtraction: a stored, static value is what "frozen"
   *   means, as opposed to a delta that a live recomputation would immediately swallow.
   * - Cannot exceed `currentPenaltyAmount` (the live-computed or migrated-snapshot figure the
   *   caller already resolved) — a reduction only ever lowers what's owed, never raises it.
   * - Cannot be applied once any penalty has already been paid on this installment (approval
   *   happens outside this system; an already-collected amount is out of scope for a waiver -
   *   that would be a refund/credit decision, explicitly not part of this feature).
   *
   * Does not itself create the audit `PenaltyReduction` row — that's the use case's job (needs the
   * repository), same division of responsibility as `ProcessPaymentUseCase` building
   * `PaymentAllocation` rows alongside this entity's own `recordPayment()` call.
   */
  /**
   * 2026-07-15 (Reduce Penalty) / 2026-07-23 (Adjust Penalty, user-confirmed): may raise OR lower
   * the penalty override — unlike the original reduce-only rule, staff can now correct a penalty
   * upward too. Still bounded by the live ADR-050/SEC-MC3-computed ceiling (`currentPenaltyAmount`)
   * on both ends: never negative, never above what the formula would actually produce today.
   */
  reducePenalty(newAmount: Money, currentPenaltyAmount: Money, reason: string, byUserId: string, at: Date = new Date()): void {
    if (this.props.paid.penalty.isPositive()) {
      throw new PenaltyAlreadyPaidError(this.props.id);
    }
    if (newAmount.isNegative()) {
      throw new PenaltyReductionExceedsCurrentAmountError(newAmount.toString(), currentPenaltyAmount.toString());
    }
    if (newAmount.greaterThan(currentPenaltyAmount)) {
      throw new PenaltyReductionExceedsCurrentAmountError(newAmount.toString(), currentPenaltyAmount.toString());
    }
    this.props.penaltyOverride = { amount: newAmount, reason, byUserId, at };
    this.props.updatedAt = new Date();
  }

  /**
   * Fees due, as currently in effect — the fees override if one is set, else the immutable
   * `due.fees` snapshot. Fees are never live-computed (no ADR-050-style daily formula exists for
   * them), so unlike `currentPenaltyOwed`'s live-vs-frozen distinction, this is the ONLY effective
   * value there ever is for fees.
   */
  get effectiveFeesDue(): Money {
    return this.props.feesOverride?.amount ?? this.props.due.fees;
  }

  /**
   * 2026-07-16 (Adjust Fees feature, user-confirmed business rules):
   * - Accounting/MIS can adjust this installment's fees due, in either direction (raise or lower —
   *   unlike `reducePenalty()`, which may only lower).
   * - `newAmount` must be non-negative; no upper ceiling (bidirectional, per the user's explicit
   *   decision).
   * - Cannot be applied once any fees have already been paid on this installment — same
   *   already-paid rule and rationale as `reducePenalty()`.
   *
   * Does not itself create the audit `FeeAdjustment` row — that's the use case's job, same division
   * of responsibility as `reducePenalty()`/`PenaltyReduction`.
   */
  adjustFees(newAmount: Money, reason: string, byUserId: string, at: Date = new Date()): void {
    if (this.props.paid.fees.isPositive()) {
      throw new FeesAlreadyPaidError(this.props.id);
    }
    if (newAmount.isNegative()) {
      throw new InvalidFeesAdjustmentAmountError(newAmount.toString());
    }
    this.props.feesOverride = { amount: newAmount, reason, byUserId, at };
    this.props.updatedAt = new Date();
  }
}

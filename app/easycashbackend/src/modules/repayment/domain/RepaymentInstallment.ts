import { randomUUID } from 'node:crypto';
import type { Money } from '@shared/domain/Money';
import { InstallmentAmounts } from './valueObjects/InstallmentAmounts';
import {
  FeesAlreadyPaidError,
  InvalidFeeChargeAmountError,
  InvalidFeesAdjustmentAmountError,
  InvalidPenaltyAdjustmentAmountError,
  InvalidPenaltyChargeAmountError,
  PenaltyAlreadyPaidError,
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
  /**
   * 2026-08-07 (user-reported): `ReversePaymentUseCase` calls this same method with negated
   * amounts to undo a payment, and this unconditionally overwrote `lastPaidAt` to `paidAt`
   * (`reversedAt` in that case) regardless of the result - a fully-reversed installment (paid back
   * down to zero) kept showing a stale "Paid Date" even though every Amount Paid column reads
   * "—". Only set `lastPaidAt` when something is actually still paid after this operation; clear
   * it back to `undefined` otherwise, matching the Amount Paid columns' own "—" state.
   */
  recordPayment(amount: InstallmentAmounts, paidAt: Date = new Date()): void {
    this.props.paid = this.props.paid.add(amount);
    this.props.lastPaidAt = this.props.paid.total().isPositive() ? paidAt : undefined;
    this.props.updatedAt = new Date();
  }

  /**
   * 2026-07-15 (Reduce Penalty) / 2026-07-23 (Adjust Penalty) / 2026-08-05 (user-confirmed - ceiling
   * removed): staff can set this installment's penalty to any non-negative amount, above OR below
   * the live ADR-050/SEC-MC3-computed figure — a real out-of-band approval (e.g. a manually-
   * assessed penalty from before this system, or a correction that legitimately exceeds the
   * formula) is a valid business case the old ceiling blocked. The caller (`ReducePenaltyUseCase`)
   * still resolves the live figure separately, to record as the audit trail's "previous" value.
   * - The override FREEZES the penalty at `newAmount` — it stops growing/shrinking per ADR-050's
   *   live daily formula from this point on, until paid or adjusted again. This is why the override
   *   is stored here rather than applied as a one-time delta: a stored, static value is what
   *   "frozen" means, as opposed to a delta a live recomputation would immediately swallow.
   * - Cannot be applied once any penalty has already been paid on this installment (approval
   *   happens outside this system; an already-collected amount is out of scope for a waiver -
   *   that would be a refund/credit decision, explicitly not part of this feature).
   *
   * Does not itself create the audit `PenaltyReduction` row — that's the use case's job (needs the
   * repository), same division of responsibility as `ProcessPaymentUseCase` building
   * `PaymentAllocation` rows alongside this entity's own `recordPayment()` call.
   */
  reducePenalty(newAmount: Money, reason: string, byUserId: string, at: Date = new Date()): void {
    if (this.props.paid.penalty.isPositive()) {
      throw new PenaltyAlreadyPaidError(this.props.id);
    }
    if (newAmount.isNegative()) {
      throw new InvalidPenaltyAdjustmentAmountError(newAmount.toString());
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

  /**
   * 2026-08-15 (Add Fee feature, user-confirmed): imposes a genuinely NEW fee charge on top of
   * whatever's currently due — distinct from `adjustFees()` above, which corrects/replaces the
   * existing amount. `amount` is strictly additive (always positive; see
   * `InvalidFeeChargeAmountError`'s own doc comment), never an absolute replacement.
   *
   * Reuses the same `feesOverride` storage `adjustFees()` uses (no new column needed) — this just
   * sets it to `effectiveFeesDue + amount` rather than to a staff-typed absolute value. Because it
   * always reads the CURRENT effective amount first, multiple charges over time correctly stack
   * (each one's `FeeCharge` audit row still records its own individual previous/new snapshot, even
   * though only the latest charge's metadata lives in the override itself — same "live state vs.
   * full history" split `adjustFees()`/`FeeAdjustment` already has).
   *
   * Unlike `adjustFees()`, NOT blocked by an already-paid fees component — a prior fee being fully
   * settled has no bearing on whether a brand new fee may be charged now.
   *
   * Does not itself create the audit `FeeCharge` row or the `FEE_CHARGED` ledger transaction —
   * that's `AddFeeUseCase`'s job, same division of responsibility as every sibling adjustment
   * method on this entity.
   */
  chargeFee(amount: Money, reason: string, byUserId: string, at: Date = new Date()): void {
    if (!amount.isPositive()) {
      throw new InvalidFeeChargeAmountError(amount.toString());
    }
    const newTotal = this.effectiveFeesDue.add(amount);
    this.props.feesOverride = { amount: newTotal, reason, byUserId, at };
    this.props.updatedAt = new Date();
  }

  /**
   * 2026-08-19 (Add Penalty feature, user-confirmed): mirrors `chargeFee()` above, but for penalty —
   * imposes a genuinely NEW penalty charge on top of whatever's currently in effect
   * (`penaltyOverride?.amount ?? due.penalty`, the same "effective" value `resolveEffectivePenaltyDue()`
   * reads elsewhere), rather than replacing it the way `reducePenalty()` does. `amount` is strictly
   * additive (always positive).
   *
   * Built for the migration period (2026-08-19): while SDevTech remains the source of truth and the
   * live ADR-050 auto-computation is disabled (`PENALTY_AUTO_COMPUTE_ENABLED=false`), staff manually
   * key in whatever penalty SDevTech's own screen shows via this method, rather than relying on this
   * system to compute it — see `CurrentPenaltyResolver.resolveComputedPenalty()`'s own doc comment
   * for the toggle.
   *
   * Reuses the same `penaltyOverride` storage `reducePenalty()` uses (no new column needed) — this
   * just sets it to `effective penalty + amount` rather than to a staff-typed absolute value. Unlike
   * `reducePenalty()`, NOT blocked by an already-paid penalty component — a prior penalty being fully
   * settled has no bearing on whether a brand new penalty may be charged now (same reasoning as
   * `chargeFee()` vs. `adjustFees()`).
   *
   * Does not itself create the audit row or the `PENALTY_APPLIED` ledger transaction — that's
   * `AddPenaltyUseCase`'s job, same division of responsibility as every sibling adjustment method on
   * this entity.
   */
  chargePenalty(amount: Money, reason: string, byUserId: string, at: Date = new Date()): void {
    if (!amount.isPositive()) {
      throw new InvalidPenaltyChargeAmountError(amount.toString());
    }
    const effectivePenaltyDue = this.props.penaltyOverride?.amount ?? this.props.due.penalty;
    const newTotal = effectivePenaltyDue.add(amount);
    this.props.penaltyOverride = { amount: newTotal, reason, byUserId, at };
    this.props.updatedAt = new Date();
  }
}

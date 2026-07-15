import { randomUUID } from 'node:crypto';
import type { Money } from '@shared/domain/Money';
import { InstallmentAmounts } from './valueObjects/InstallmentAmounts';
import { PenaltyAlreadyPaidError, PenaltyReductionExceedsCurrentAmountError } from './errors/RepaymentDomainErrors';

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

export interface RepaymentInstallmentProps {
  id: string;
  loanAccountId: string;
  installmentNumber: number;
  dueDate: Date;
  due: InstallmentAmounts;
  paid: InstallmentAmounts;
  lastPaidAt?: Date;
  penaltyOverride?: PenaltyOverride;
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
   * REPAY-3, derived — never stored/settable directly.
   *
   * ASSUMPTION (not verified against legacy data — flag for confirmation
   * before this precedence is relied on by a real collections/aging
   * report): an overdue installment is reported LATE even if it has a
   * partial payment, i.e. LATE takes precedence over PARTIALLY_PAID once
   * the due date has passed. PROJECT_RULES.md does not specify this
   * precedence explicitly.
   */
  get status(): RepaymentInstallmentStatus {
    const totalDue = this.props.due.total();
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
}

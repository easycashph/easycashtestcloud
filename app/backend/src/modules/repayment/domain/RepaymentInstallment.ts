import { randomUUID } from 'node:crypto';
import { InstallmentAmounts } from './valueObjects/InstallmentAmounts';

export type RepaymentInstallmentStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'LATE';

export interface RepaymentInstallmentProps {
  id: string;
  loanAccountId: string;
  installmentNumber: number;
  dueDate: Date;
  due: InstallmentAmounts;
  paid: InstallmentAmounts;
  lastPaidAt?: Date;
  legacyId?: string;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Milestone 9.1 checkpoint 5 / `docs/Architecture/ADR-optimistic-
   * concurrency.md`: read-only at this checkpoint — see the identical note
   * on `LoanAccountProps.version` (`modules/loan-account/domain/
   * LoanAccount.ts`) for the full rationale.
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

  private constructor(props: RepaymentInstallmentProps) {
    this.props = props;
  }

  static create(input: CreateRepaymentInstallmentProps): RepaymentInstallment {
    const now = new Date();
    return new RepaymentInstallment({
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
    });
  }

  static reconstitute(props: RepaymentInstallmentProps): RepaymentInstallment {
    return new RepaymentInstallment(props);
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
}

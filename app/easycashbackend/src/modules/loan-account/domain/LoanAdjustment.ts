import { randomUUID } from 'node:crypto';

export interface LoanAdjustmentProps {
  id: string;
  oldLoanAccountId: string;
  newLoanAccountId: string;
  previousFirstRepaymentDate: Date;
  newFirstRepaymentDate: Date;
  reason?: string;
  adjustedByUserId: string;
  createdAt: Date;
  /** 2026-08-07 (Undo Adjustment feature) — both undefined until undone; see `markUndone()`. */
  undoneAt?: Date;
  undoneByUserId?: string;
}

export interface CreateLoanAdjustmentProps {
  oldLoanAccountId: string;
  newLoanAccountId: string;
  previousFirstRepaymentDate: Date;
  newFirstRepaymentDate: Date;
  reason?: string;
  adjustedByUserId: string;
}

/**
 * 2026-07-24 (Loan Adjustment feature, user-confirmed): one immutable row per adjustment action —
 * same "historical record, never edited" posture as `LoanRestructure`/`PenaltyReduction`. Unlike
 * `LoanRestructure`, there is no principal/balance change to record here at all - the ONLY thing
 * that changes is the schedule's due dates (same principal, rate, term, product copied verbatim),
 * so this entity just links old<->new loan account ids and captures the date change itself.
 */
export class LoanAdjustment {
  private constructor(private readonly props: LoanAdjustmentProps) {}

  static create(input: CreateLoanAdjustmentProps): LoanAdjustment {
    return new LoanAdjustment({
      id: randomUUID(),
      oldLoanAccountId: input.oldLoanAccountId,
      newLoanAccountId: input.newLoanAccountId,
      previousFirstRepaymentDate: input.previousFirstRepaymentDate,
      newFirstRepaymentDate: input.newFirstRepaymentDate,
      reason: input.reason,
      adjustedByUserId: input.adjustedByUserId,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: LoanAdjustmentProps): LoanAdjustment {
    return new LoanAdjustment(props);
  }

  /**
   * 2026-08-07 (Undo Adjustment feature, user-confirmed): the ONE exception to this row's own
   * "immutable, never edited" doc comment above - marks it undone rather than deleting it, so the
   * adjustment still shows in this loan's history. Throws if already undone (the use-case layer's
   * `LoanAdjustmentAlreadyUndoneError` pre-check is the friendlier path; this is a last-resort
   * guard).
   */
  markUndone(undoneByUserId: string, undoneAt: Date = new Date()): void {
    if (this.props.undoneAt) {
      throw new Error(`LoanAdjustment ${this.props.id} is already undone.`);
    }
    this.props.undoneAt = undoneAt;
    this.props.undoneByUserId = undoneByUserId;
  }

  get id(): string {
    return this.props.id;
  }

  get oldLoanAccountId(): string {
    return this.props.oldLoanAccountId;
  }

  get newLoanAccountId(): string {
    return this.props.newLoanAccountId;
  }

  get previousFirstRepaymentDate(): Date {
    return this.props.previousFirstRepaymentDate;
  }

  get newFirstRepaymentDate(): Date {
    return this.props.newFirstRepaymentDate;
  }

  get reason(): string | undefined {
    return this.props.reason;
  }

  get adjustedByUserId(): string {
    return this.props.adjustedByUserId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get undoneAt(): Date | undefined {
    return this.props.undoneAt;
  }

  get undoneByUserId(): string | undefined {
    return this.props.undoneByUserId;
  }
}

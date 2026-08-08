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
 *
 * 2026-08-08 (Undo Adjustment, user-confirmed revision): undo now DELETES this row (and the new
 * LoanAccount it points to) outright rather than marking it "undone" — the user decided a
 * reverted adjustment should leave no trace, not a retired record. See `UndoAdjustLoanUseCase`.
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
}

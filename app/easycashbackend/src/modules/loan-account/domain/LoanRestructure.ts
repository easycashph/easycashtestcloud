import { randomUUID } from 'node:crypto';
import { Money } from '@shared/domain/Money';

export interface LoanRestructureProps {
  id: string;
  oldLoanAccountId: string;
  newLoanAccountId: string;
  previousCollectionsBalance: Money;
  newPrincipalAmount: Money;
  reason?: string;
  restructuredByUserId: string;
  createdAt: Date;
}

export interface CreateLoanRestructureProps {
  oldLoanAccountId: string;
  newLoanAccountId: string;
  previousCollectionsBalance: Money;
  newPrincipalAmount: Money;
  reason?: string;
  restructuredByUserId: string;
}

/**
 * 2026-07-24 (Loan Restructure feature, user-confirmed): one immutable row per restructure
 * action — same "historical record, never edited" posture as `PenaltyReduction`/`FeeAdjustment`.
 * Links the OLD (now `CLOSED_RESTRUCTURED`) `LoanAccount` to the brand new one created from its
 * remaining Collections Balance.
 *
 * 2026-08-08 (Undo Restructure, user-confirmed revision): undo now DELETES this row (and the new
 * LoanAccount it points to) outright rather than marking it "undone" — the user decided a
 * reverted restructure should leave no trace, not a retired record. See
 * `UndoRestructureLoanUseCase`.
 */
export class LoanRestructure {
  private constructor(private readonly props: LoanRestructureProps) {}

  static create(input: CreateLoanRestructureProps): LoanRestructure {
    return new LoanRestructure({
      id: randomUUID(),
      oldLoanAccountId: input.oldLoanAccountId,
      newLoanAccountId: input.newLoanAccountId,
      previousCollectionsBalance: input.previousCollectionsBalance,
      newPrincipalAmount: input.newPrincipalAmount,
      reason: input.reason,
      restructuredByUserId: input.restructuredByUserId,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: LoanRestructureProps): LoanRestructure {
    return new LoanRestructure(props);
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

  get previousCollectionsBalance(): Money {
    return this.props.previousCollectionsBalance;
  }

  get newPrincipalAmount(): Money {
    return this.props.newPrincipalAmount;
  }

  get reason(): string | undefined {
    return this.props.reason;
  }

  get restructuredByUserId(): string {
    return this.props.restructuredByUserId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

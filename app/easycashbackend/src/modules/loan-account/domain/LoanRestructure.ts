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
  /** 2026-08-07 (Undo Restructure feature) — both undefined until undone; see `markUndone()`. */
  undoneAt?: Date;
  undoneByUserId?: string;
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

  /**
   * 2026-08-07 (Undo Restructure feature, user-confirmed): the ONE exception to this row's own
   * "immutable, never edited" doc comment above - marks it undone rather than deleting it, so the
   * restructure still shows in this loan's history. Throws if already undone (the use-case layer's
   * `LoanAlreadyUndoneError` pre-check is the friendlier path; this is a last-resort guard).
   */
  markUndone(undoneByUserId: string, undoneAt: Date = new Date()): void {
    if (this.props.undoneAt) {
      throw new Error(`LoanRestructure ${this.props.id} is already undone.`);
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

  get undoneAt(): Date | undefined {
    return this.props.undoneAt;
  }

  get undoneByUserId(): string | undefined {
    return this.props.undoneByUserId;
  }
}

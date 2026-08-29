import { randomUUID } from 'node:crypto';
import { Money } from '@shared/domain/Money';

export interface LoanCompromiseSettlementItemProps {
  id: string;
  oldLoanAccountId: string;
  previousCollectionsBalance: Money;
}

export interface LoanCompromiseSettlementProps {
  id: string;
  newLoanAccountId: string;
  totalPreviousBalance: Money;
  settlementAmount: Money;
  reason?: string;
  settledByUserId: string;
  createdAt: Date;
  items: LoanCompromiseSettlementItemProps[];
}

export interface CreateLoanCompromiseSettlementItemInput {
  oldLoanAccountId: string;
  previousCollectionsBalance: Money;
}

export interface CreateLoanCompromiseSettlementProps {
  newLoanAccountId: string;
  settlementAmount: Money;
  reason?: string;
  settledByUserId: string;
  items: CreateLoanCompromiseSettlementItemInput[];
}

/**
 * 2026-08-29 (Compromise Settlement feature, user-confirmed - grew out of migrating SDevTech's own
 * "Compromise Agreement" closure reason, see migrate-legacy-data.ts/
 * backfill-loan-restructure-compromise.ts): one immutable row per settlement action, same
 * "historical record, never edited" posture as `LoanRestructure`. Unlike `LoanRestructure`
 * (strictly 1 old loan : 1 new loan), a settlement folds ONE OR MORE old loans (same borrower,
 * `items`) into ONE new loan at a negotiated, staff-entered write-down amount - not a straight
 * balance carry-forward, so `settlementAmount` is never derived/computed here, only supplied.
 */
export class LoanCompromiseSettlement {
  private constructor(private readonly props: LoanCompromiseSettlementProps) {}

  static create(input: CreateLoanCompromiseSettlementProps): LoanCompromiseSettlement {
    const totalPreviousBalance = input.items.reduce((sum, item) => sum.add(item.previousCollectionsBalance), Money.ZERO);
    return new LoanCompromiseSettlement({
      id: randomUUID(),
      newLoanAccountId: input.newLoanAccountId,
      totalPreviousBalance,
      settlementAmount: input.settlementAmount,
      reason: input.reason,
      settledByUserId: input.settledByUserId,
      createdAt: new Date(),
      items: input.items.map((item) => ({
        id: randomUUID(),
        oldLoanAccountId: item.oldLoanAccountId,
        previousCollectionsBalance: item.previousCollectionsBalance,
      })),
    });
  }

  static reconstitute(props: LoanCompromiseSettlementProps): LoanCompromiseSettlement {
    return new LoanCompromiseSettlement(props);
  }

  get id(): string {
    return this.props.id;
  }

  get newLoanAccountId(): string {
    return this.props.newLoanAccountId;
  }

  get totalPreviousBalance(): Money {
    return this.props.totalPreviousBalance;
  }

  get settlementAmount(): Money {
    return this.props.settlementAmount;
  }

  get reason(): string | undefined {
    return this.props.reason;
  }

  get settledByUserId(): string {
    return this.props.settledByUserId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get items(): LoanCompromiseSettlementItemProps[] {
    return this.props.items;
  }
}

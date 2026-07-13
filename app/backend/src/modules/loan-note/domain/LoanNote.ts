import { randomUUID } from 'node:crypto';

export interface LoanNoteProps {
  id: string;
  loanAccountId: string;
  authorUserId: string;
  text: string;
  createdAt: Date;
}

export interface CreateLoanNoteProps {
  loanAccountId: string;
  authorUserId: string;
  text: string;
}

/**
 * 2026-07-11 (user request, Collections use case): a free-text note tied to a loan account — e.g.
 * what was discussed/agreed with the borrower during a collection call. Deliberately simple (just
 * text + author + timestamp, no structured contact-method/outcome fields) per explicit user
 * decision — flexibility over structure. Append-only, like `AppliedFee`/`PaymentAllocation`: no
 * update/delete anywhere in this system — a correction is a new note, not an edit of history.
 */
export class LoanNote {
  private constructor(private readonly props: LoanNoteProps) {}

  static create(input: CreateLoanNoteProps): LoanNote {
    return new LoanNote({
      id: randomUUID(),
      loanAccountId: input.loanAccountId,
      authorUserId: input.authorUserId,
      text: input.text,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: LoanNoteProps): LoanNote {
    return new LoanNote(props);
  }

  get id(): string {
    return this.props.id;
  }

  get loanAccountId(): string {
    return this.props.loanAccountId;
  }

  get authorUserId(): string {
    return this.props.authorUserId;
  }

  get text(): string {
    return this.props.text;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}

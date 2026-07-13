import { randomUUID } from 'node:crypto';
import { PersonName } from './valueObjects/PersonName';
import { Address } from './valueObjects/Address';

export interface CoBorrowerProps {
  id: string;
  name: PersonName;
  gender?: string;
  civilStatus?: string;
  birthDate?: Date;
  phoneNumber?: string;
  emailAddress?: string;
  relationship?: string;
  employer?: string;
  legacyId?: string;
  addresses: Address[];
}

export interface CreateCoBorrowerProps {
  name: PersonName;
  gender?: string;
  civilStatus?: string;
  birthDate?: Date;
  phoneNumber?: string;
  emailAddress?: string;
  relationship?: string;
  employer?: string;
  legacyId?: string;
  addresses?: Address[];
}

/**
 * Independent aggregate root (ADR-042 §3), NOT a child of Borrower or
 * LoanAccount. ADR-015 (per-borrower vs. per-loan co-borrower scope) is
 * still open; modeling CoBorrower as a peer aggregate, referenced from
 * LoanAccount only via the LoanAccountCoBorrower join table's
 * coBorrowerId, stays correct under either resolution.
 */
export class CoBorrower {
  private constructor(private props: CoBorrowerProps) {}

  static create(input: CreateCoBorrowerProps): CoBorrower {
    return new CoBorrower({
      id: randomUUID(),
      name: input.name,
      gender: input.gender,
      civilStatus: input.civilStatus,
      birthDate: input.birthDate,
      phoneNumber: input.phoneNumber,
      emailAddress: input.emailAddress,
      relationship: input.relationship,
      employer: input.employer,
      legacyId: input.legacyId,
      addresses: input.addresses ?? [],
    });
  }

  static reconstitute(props: CoBorrowerProps): CoBorrower {
    return new CoBorrower(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): PersonName {
    return this.props.name;
  }

  get gender(): string | undefined {
    return this.props.gender;
  }

  get civilStatus(): string | undefined {
    return this.props.civilStatus;
  }

  get birthDate(): Date | undefined {
    return this.props.birthDate;
  }

  get phoneNumber(): string | undefined {
    return this.props.phoneNumber;
  }

  get emailAddress(): string | undefined {
    return this.props.emailAddress;
  }

  get relationship(): string | undefined {
    return this.props.relationship;
  }

  get employer(): string | undefined {
    return this.props.employer;
  }

  get legacyId(): string | undefined {
    return this.props.legacyId;
  }

  get addresses(): readonly Address[] {
    return this.props.addresses;
  }
}

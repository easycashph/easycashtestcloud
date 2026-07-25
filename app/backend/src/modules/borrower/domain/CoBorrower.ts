import { randomUUID } from 'node:crypto';
import { PersonName } from './valueObjects/PersonName';
import { Address } from './valueObjects/Address';

export interface CoBorrowerProps {
  id: string;
  /** 2026-07-16 (ADR-015 resolved: per-Borrower) — see this class's own doc comment. Optional only
   * for the one already-migrated CoBorrower row with no derivable owner (see the backfill script). */
  borrowerId?: string;
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
  borrowerId?: string;
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
 * Independent aggregate root (ADR-042 §3), NOT a child of Borrower or LoanAccount — referenced
 * from a Borrower via `borrowerId`, and (historically) from LoanAccount via the
 * LoanAccountCoBorrower join table's coBorrowerId.
 *
 * ADR-015 RESOLVED (2026-07-16, user decision): per-Borrower, not per-LoanAccount — a client's
 * co-borrowers belong to them directly and appear on every one of their loans, matching how the
 * legacy sdev system's own `co_borrowers.parent_key` already scoped this (to the client, not a
 * specific loan) before migration. `LoanAccountCoBorrower` remains as a historical per-loan
 * attachment record but is no longer the primary way a co-borrower is associated with a client.
 */
export class CoBorrower {
  private constructor(private props: CoBorrowerProps) {}

  static create(input: CreateCoBorrowerProps): CoBorrower {
    return new CoBorrower({
      id: randomUUID(),
      borrowerId: input.borrowerId,
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

  get borrowerId(): string | undefined {
    return this.props.borrowerId;
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

  /** PATCH semantics - only fields present (not `undefined`) are applied. Lets CRM staff correct a
   * co-borrower's details when the person named on the loan application intake didn't pass
   * verification (e.g. wrong contact info, or staff needs to swap in the actual co-borrower). */
  updateDetails(patch: {
    name?: PersonName;
    gender?: string;
    civilStatus?: string;
    birthDate?: Date;
    phoneNumber?: string;
    emailAddress?: string;
    relationship?: string;
    employer?: string;
  }): void {
    if (patch.name !== undefined) this.props.name = patch.name;
    if (patch.gender !== undefined) this.props.gender = patch.gender;
    if (patch.civilStatus !== undefined) this.props.civilStatus = patch.civilStatus;
    if (patch.birthDate !== undefined) this.props.birthDate = patch.birthDate;
    if (patch.phoneNumber !== undefined) this.props.phoneNumber = patch.phoneNumber;
    if (patch.emailAddress !== undefined) this.props.emailAddress = patch.emailAddress;
    if (patch.relationship !== undefined) this.props.relationship = patch.relationship;
    if (patch.employer !== undefined) this.props.employer = patch.employer;
  }

  /** Always replaces the whole list — an Address has no independent identity to merge against (see Address VO doc comment). */
  replaceAddresses(addresses: Address[]): void {
    this.props.addresses = addresses;
  }
}

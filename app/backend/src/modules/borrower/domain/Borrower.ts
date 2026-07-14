import { randomUUID } from 'node:crypto';
import { PersonName } from './valueObjects/PersonName';
import { Address } from './valueObjects/Address';

export type BorrowerStatus = 'ACTIVE' | 'INACTIVE';

/** Plain child shape — 1:1 with Borrower, no independent invariants documented in PROJECT_RULES.md. */
export interface BorrowerIncomeDetail {
  employmentType?: string;
  employerName?: string;
  employerAddress?: string;
  natureOfBusiness?: string;
  position?: string;
  yearsEmployed?: number;
  monthlyIncome?: number;
}

/** Plain child shape — 1:1 with Borrower. */
export interface BorrowerGovernmentId {
  sssNumber?: string;
  tinNumber?: string;
}

/** Plain child shape — one-to-many, no independent invariants beyond belonging to a Borrower. */
export interface IdentificationDocument {
  id: string;
  documentType: string;
  documentNumber: string;
  issuingAuthority?: string;
  validUntil?: Date;
}

/** ADR-013: optional by default — legacy data shows this is rarely populated. */
export interface CharacterReference {
  id: string;
  firstName: string;
  lastName: string;
  relationship?: string;
  phoneNumber?: string;
  emailAddress?: string;
}

export interface BorrowerDependant {
  name: string;
  age?: string;
  relationship?: string;
}

export interface BorrowerProps {
  id: string;
  branchId: string;
  assignedLoanOfficerId?: string;
  name: PersonName;
  gender?: string;
  birthDate?: Date;
  placeOfBirth?: string;
  nationality?: string;
  civilStatus?: string;
  homeOwnership?: string;
  mobilePhone1?: string;
  mobilePhone2?: string;
  email?: string;
  dependants?: BorrowerDependant[];
  note?: string;
  status: BorrowerStatus;
  loanCycle: number;
  legacyId?: string;
  /** LoanApplication this borrower was created from via "Create Client Profile", if any. */
  sourceApplicationId?: string;
  createdAt: Date;
  updatedAt: Date;
  incomeDetail?: BorrowerIncomeDetail;
  governmentId?: BorrowerGovernmentId;
  identificationDocuments: IdentificationDocument[];
  characterReferences: CharacterReference[];
  addresses: Address[];
}

export interface CreateBorrowerProps {
  branchId: string;
  assignedLoanOfficerId?: string;
  name: PersonName;
  gender?: string;
  birthDate?: Date;
  placeOfBirth?: string;
  nationality?: string;
  civilStatus?: string;
  homeOwnership?: string;
  mobilePhone1?: string;
  mobilePhone2?: string;
  email?: string;
  dependants?: BorrowerDependant[];
  note?: string;
  legacyId?: string;
  sourceApplicationId?: string;
  incomeDetail?: BorrowerIncomeDetail;
  governmentId?: BorrowerGovernmentId;
  identificationDocuments?: IdentificationDocument[];
  characterReferences?: CharacterReference[];
  addresses?: Address[];
}

/**
 * Aggregate root (ADR-042 §2). Owns its income/government-ID detail,
 * identification documents, character references, and addresses as its
 * consistency boundary — all `onDelete: Cascade` in the schema, reflecting
 * that these children never outlive their Borrower.
 */
export class Borrower {
  private constructor(private props: BorrowerProps) {}

  static create(input: CreateBorrowerProps): Borrower {
    const now = new Date();
    return new Borrower({
      id: randomUUID(),
      branchId: input.branchId,
      assignedLoanOfficerId: input.assignedLoanOfficerId,
      name: input.name,
      gender: input.gender,
      birthDate: input.birthDate,
      placeOfBirth: input.placeOfBirth,
      nationality: input.nationality,
      civilStatus: input.civilStatus,
      homeOwnership: input.homeOwnership,
      mobilePhone1: input.mobilePhone1,
      mobilePhone2: input.mobilePhone2,
      email: input.email,
      dependants: input.dependants,
      note: input.note,
      status: 'ACTIVE',
      loanCycle: 0,
      legacyId: input.legacyId,
      sourceApplicationId: input.sourceApplicationId,
      createdAt: now,
      updatedAt: now,
      incomeDetail: input.incomeDetail,
      governmentId: input.governmentId,
      identificationDocuments: input.identificationDocuments ?? [],
      characterReferences: input.characterReferences ?? [],
      addresses: input.addresses ?? [],
    });
  }

  /** Rehydrates a Borrower from already-persisted, already-trusted data — no defaulting. */
  static reconstitute(props: BorrowerProps): Borrower {
    return new Borrower(props);
  }

  get id(): string {
    return this.props.id;
  }

  get branchId(): string {
    return this.props.branchId;
  }

  get assignedLoanOfficerId(): string | undefined {
    return this.props.assignedLoanOfficerId;
  }

  get name(): PersonName {
    return this.props.name;
  }

  get gender(): string | undefined {
    return this.props.gender;
  }

  get birthDate(): Date | undefined {
    return this.props.birthDate;
  }

  get placeOfBirth(): string | undefined {
    return this.props.placeOfBirth;
  }

  get nationality(): string | undefined {
    return this.props.nationality;
  }

  get civilStatus(): string | undefined {
    return this.props.civilStatus;
  }

  get homeOwnership(): string | undefined {
    return this.props.homeOwnership;
  }

  get mobilePhone1(): string | undefined {
    return this.props.mobilePhone1;
  }

  get mobilePhone2(): string | undefined {
    return this.props.mobilePhone2;
  }

  get email(): string | undefined {
    return this.props.email;
  }

  get dependants(): readonly BorrowerDependant[] | undefined {
    return this.props.dependants;
  }

  get note(): string | undefined {
    return this.props.note;
  }

  get status(): BorrowerStatus {
    return this.props.status;
  }

  get loanCycle(): number {
    return this.props.loanCycle;
  }

  get legacyId(): string | undefined {
    return this.props.legacyId;
  }

  get sourceApplicationId(): string | undefined {
    return this.props.sourceApplicationId;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get incomeDetail(): BorrowerIncomeDetail | undefined {
    return this.props.incomeDetail;
  }

  get governmentId(): BorrowerGovernmentId | undefined {
    return this.props.governmentId;
  }

  get identificationDocuments(): readonly IdentificationDocument[] {
    return this.props.identificationDocuments;
  }

  get characterReferences(): readonly CharacterReference[] {
    return this.props.characterReferences;
  }

  get addresses(): readonly Address[] {
    return this.props.addresses;
  }

  assignLoanOfficer(userId: string): void {
    this.props.assignedLoanOfficerId = userId;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.status = 'INACTIVE';
    this.props.updatedAt = new Date();
  }

  reactivate(): void {
    this.props.status = 'ACTIVE';
    this.props.updatedAt = new Date();
  }

  /** Incremented when a new loan is originated for this borrower — LA-lifecycle adjacent, not itself a hard rule yet. */
  incrementLoanCycle(): void {
    this.props.loanCycle += 1;
    this.props.updatedAt = new Date();
  }

  /** PATCH-style: only overwrites fields actually present in `patch`; `name`, if given, must already be a full PersonName (built by the caller from whichever of first/middle/last changed). */
  updateContactDetails(patch: {
    name?: PersonName;
    civilStatus?: string;
    mobilePhone1?: string;
    mobilePhone2?: string;
    email?: string;
  }): void {
    if (patch.name !== undefined) this.props.name = patch.name;
    if (patch.civilStatus !== undefined) this.props.civilStatus = patch.civilStatus;
    if (patch.mobilePhone1 !== undefined) this.props.mobilePhone1 = patch.mobilePhone1;
    if (patch.mobilePhone2 !== undefined) this.props.mobilePhone2 = patch.mobilePhone2;
    if (patch.email !== undefined) this.props.email = patch.email;
    this.props.updatedAt = new Date();
  }

  /** Always replaces the whole list — an Address has no independent identity to merge against (see Address VO doc comment). */
  replaceAddresses(addresses: Address[]): void {
    this.props.addresses = addresses;
    this.props.updatedAt = new Date();
  }
}

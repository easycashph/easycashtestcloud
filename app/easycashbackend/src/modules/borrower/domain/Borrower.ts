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
  /** 2026-07-16 (Create Client Account) — legacy Excel LMS's Client_details "Months Employed" column. */
  monthsEmployed?: number;
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
  /** 2026-07-16 (Create Client Account) — legacy Excel LMS's Client_details "Suffix" column. */
  suffix?: string;
  gender?: string;
  birthDate?: Date;
  placeOfBirth?: string;
  nationality?: string;
  civilStatus?: string;
  homeOwnership?: string;
  mobilePhone1?: string;
  mobilePhone2?: string;
  email?: string;
  /** 2026-07-16 (Create Client Account) — legacy Excel LMS's Client_details "facebook" column. */
  facebookLink?: string;
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
  suffix?: string;
  gender?: string;
  birthDate?: Date;
  placeOfBirth?: string;
  nationality?: string;
  civilStatus?: string;
  homeOwnership?: string;
  mobilePhone1?: string;
  mobilePhone2?: string;
  email?: string;
  facebookLink?: string;
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
      suffix: input.suffix,
      gender: input.gender,
      birthDate: input.birthDate,
      placeOfBirth: input.placeOfBirth,
      nationality: input.nationality,
      civilStatus: input.civilStatus,
      homeOwnership: input.homeOwnership,
      mobilePhone1: input.mobilePhone1,
      mobilePhone2: input.mobilePhone2,
      email: input.email,
      facebookLink: input.facebookLink,
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

  get suffix(): string | undefined {
    return this.props.suffix;
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

  get facebookLink(): string | undefined {
    return this.props.facebookLink;
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
    suffix?: string;
    gender?: string;
    birthDate?: Date;
    placeOfBirth?: string;
    nationality?: string;
    civilStatus?: string;
    homeOwnership?: string;
    mobilePhone1?: string;
    mobilePhone2?: string;
    email?: string;
    facebookLink?: string;
  }): void {
    if (patch.name !== undefined) this.props.name = patch.name;
    if (patch.suffix !== undefined) this.props.suffix = patch.suffix;
    if (patch.gender !== undefined) this.props.gender = patch.gender;
    if (patch.birthDate !== undefined) this.props.birthDate = patch.birthDate;
    if (patch.placeOfBirth !== undefined) this.props.placeOfBirth = patch.placeOfBirth;
    if (patch.nationality !== undefined) this.props.nationality = patch.nationality;
    if (patch.civilStatus !== undefined) this.props.civilStatus = patch.civilStatus;
    if (patch.homeOwnership !== undefined) this.props.homeOwnership = patch.homeOwnership;
    if (patch.mobilePhone1 !== undefined) this.props.mobilePhone1 = patch.mobilePhone1;
    if (patch.mobilePhone2 !== undefined) this.props.mobilePhone2 = patch.mobilePhone2;
    if (patch.email !== undefined) this.props.email = patch.email;
    if (patch.facebookLink !== undefined) this.props.facebookLink = patch.facebookLink;
    this.props.updatedAt = new Date();
  }

  /** Merges into the existing 1:1 income detail (creates one if none exists yet) — PATCH-style like updateContactDetails. */
  updateIncomeDetail(patch: Partial<BorrowerIncomeDetail>): void {
    this.props.incomeDetail = { ...this.props.incomeDetail, ...patch };
    this.props.updatedAt = new Date();
  }

  /** Always replaces the whole list — an Address has no independent identity to merge against (see Address VO doc comment). */
  replaceAddresses(addresses: Address[]): void {
    this.props.addresses = addresses;
    this.props.updatedAt = new Date();
  }

  /** Merges into the existing 1:1 government id (creates one if none exists yet) - PATCH-style
   * like updateIncomeDetail (2026-07-31 user request, Portal "My Profile" TIN/SSS fields). */
  updateGovernmentId(patch: Partial<BorrowerGovernmentId>): void {
    this.props.governmentId = { ...this.props.governmentId, ...patch };
    this.props.updatedAt = new Date();
  }

  /** Always replaces the whole list, same reasoning as replaceAddresses - a dependant has no
   * independent identity of its own to merge against (2026-07-31 user request). */
  updateDependants(dependants: BorrowerDependant[]): void {
    this.props.dependants = dependants;
    this.props.updatedAt = new Date();
  }

  /** Always replaces the whole list (2026-07-31 user request, Portal "My Profile" - previously
   * create-only, set once at Borrower creation from the source LoanApplication and never
   * editable afterward by anyone, staff included). `id` is ignored on input - the repository
   * always deletes and recreates this bounded collection, matching replaceAddresses. */
  replaceCharacterReferences(references: Array<Omit<CharacterReference, 'id'>>): void {
    this.props.characterReferences = references.map((r) => ({ id: '', ...r }));
    this.props.updatedAt = new Date();
  }
}

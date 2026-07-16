import { randomUUID } from 'node:crypto';
import { InvalidLoanApplicationTransitionError, ProductNotAssignedError } from './errors/LoanApplicationDomainErrors';

/** PREAPPROVED/PREDECLINED are computed by LoanApplicationPreQualificationService — advisory only,
 * the officer still makes the real APPROVED/DECLINED call. */
export type LoanApplicationStatus = 'PREAPPROVED' | 'PREDECLINED' | 'APPROVED' | 'DECLINED';
export type LoanApplicationAccountType = 'NEW' | 'RENEWAL';

export interface DependantEntry {
  name: string;
  age?: string;
  relationship?: string;
}

export interface LoanApplicationProps {
  id: string;
  branchId: string;
  /** Set only when this application was created FROM an existing client's profile (renewal flow)
   * - see schema.prisma's LoanApplication.borrowerId doc comment for the full explanation. */
  borrowerId?: string;

  applicantName: string;
  age?: number;
  gender?: string;
  civilStatus?: string;
  birthDate?: Date;
  placeOfBirth?: string;
  nationality?: string;
  homeOwnership?: string;
  address?: string;
  houseUnitNumber?: string;
  street?: string;
  barangay?: string;
  cityMunicipality?: string;
  province?: string;
  zipCode?: string;
  monthlyIncome?: number;
  employer?: string;
  occupation?: string;
  officeAddress?: string;
  tinNumber?: string;
  sssNumber?: string;
  propertiesOwned: string[];
  creditScore?: number;
  coBorrowerName?: string;
  coBorrowerEmployer?: string;
  coBorrowerContactNumber?: string;
  coBorrowerEmail?: string;
  coBorrowerAddress?: string;
  mobilePhone?: string;
  email?: string;
  dependants?: DependantEntry[];
  reference1Name?: string;
  reference1Mobile?: string;
  reference2Name?: string;
  reference2Mobile?: string;
  note?: string;

  referralSource?: string;
  accountType?: LoanApplicationAccountType;
  loanPurpose?: string;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  submittedDocuments: string[];

  encodedByUserId?: string;

  status: LoanApplicationStatus;
  /** Cached from LoanApplicationPreQualificationService's geocoding — null if unresolved (distance
   * rule fails open in that case). */
  distanceFromBranchKm?: number;
  assignedLoanProductVersionId?: string;

  reviewedByUserId?: string;
  reviewedAt?: Date;
  decisionNote?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLoanApplicationProps {
  branchId: string;
  borrowerId?: string;
  applicantName: string;
  age?: number;
  gender?: string;
  civilStatus?: string;
  birthDate?: Date;
  placeOfBirth?: string;
  nationality?: string;
  homeOwnership?: string;
  address?: string;
  houseUnitNumber?: string;
  street?: string;
  barangay?: string;
  cityMunicipality?: string;
  province?: string;
  zipCode?: string;
  monthlyIncome?: number;
  employer?: string;
  occupation?: string;
  officeAddress?: string;
  tinNumber?: string;
  sssNumber?: string;
  propertiesOwned?: string[];
  creditScore?: number;
  coBorrowerName?: string;
  coBorrowerEmployer?: string;
  coBorrowerContactNumber?: string;
  coBorrowerEmail?: string;
  coBorrowerAddress?: string;
  mobilePhone?: string;
  email?: string;
  dependants?: DependantEntry[];
  reference1Name?: string;
  reference1Mobile?: string;
  reference2Name?: string;
  reference2Mobile?: string;
  note?: string;
  referralSource?: string;
  accountType?: LoanApplicationAccountType;
  loanPurpose?: string;
  requestedCategory: string;
  requestedAmount: number;
  requestedTermMonths: number;
  submittedDocuments?: string[];
  encodedByUserId?: string;
  /** Computed by LoanApplicationPreQualificationService before construction — geocoding/rate
   * lookup is I/O and does not belong in this domain layer. */
  status: 'PREAPPROVED' | 'PREDECLINED';
  distanceFromBranchKm?: number;
}

/**
 * Milestone 9.2: the intake/decision workflow. `status` starts as a system-computed
 * PREAPPROVED/PREDECLINED (see LoanApplicationPreQualificationService), and the officer's
 * approve()/decline() moves it to APPROVED/DECLINED — a MIS-only revert() can undo that decision
 * back to a freshly recomputed system verdict. Converting an APPROVED application into a real
 * Borrower/LoanAccount is a deliberately separate follow-up (see schema.prisma's LoanApplication
 * doc comment) — not modeled on this entity at all.
 */
export class LoanApplication {
  private constructor(private readonly props: LoanApplicationProps) {}

  static create(input: CreateLoanApplicationProps): LoanApplication {
    const now = new Date();
    return new LoanApplication({
      id: randomUUID(),
      branchId: input.branchId,
      borrowerId: input.borrowerId,
      applicantName: input.applicantName,
      age: input.age,
      gender: input.gender,
      civilStatus: input.civilStatus,
      birthDate: input.birthDate,
      placeOfBirth: input.placeOfBirth,
      nationality: input.nationality,
      homeOwnership: input.homeOwnership,
      address: input.address,
      houseUnitNumber: input.houseUnitNumber,
      street: input.street,
      barangay: input.barangay,
      cityMunicipality: input.cityMunicipality,
      province: input.province,
      zipCode: input.zipCode,
      monthlyIncome: input.monthlyIncome,
      employer: input.employer,
      occupation: input.occupation,
      officeAddress: input.officeAddress,
      tinNumber: input.tinNumber,
      sssNumber: input.sssNumber,
      propertiesOwned: input.propertiesOwned ?? [],
      creditScore: input.creditScore,
      coBorrowerName: input.coBorrowerName,
      coBorrowerEmployer: input.coBorrowerEmployer,
      coBorrowerContactNumber: input.coBorrowerContactNumber,
      coBorrowerEmail: input.coBorrowerEmail,
      coBorrowerAddress: input.coBorrowerAddress,
      mobilePhone: input.mobilePhone,
      email: input.email,
      dependants: input.dependants,
      reference1Name: input.reference1Name,
      reference1Mobile: input.reference1Mobile,
      reference2Name: input.reference2Name,
      reference2Mobile: input.reference2Mobile,
      note: input.note,
      referralSource: input.referralSource,
      accountType: input.accountType,
      loanPurpose: input.loanPurpose,
      requestedCategory: input.requestedCategory,
      requestedAmount: input.requestedAmount,
      requestedTermMonths: input.requestedTermMonths,
      submittedDocuments: input.submittedDocuments ?? [],
      encodedByUserId: input.encodedByUserId,
      status: input.status,
      distanceFromBranchKm: input.distanceFromBranchKm,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: LoanApplicationProps): LoanApplication {
    return new LoanApplication(props);
  }

  get id(): string {
    return this.props.id;
  }

  get branchId(): string {
    return this.props.branchId;
  }

  get borrowerId(): string | undefined {
    return this.props.borrowerId;
  }

  get status(): LoanApplicationStatus {
    return this.props.status;
  }

  get assignedLoanProductVersionId(): string | undefined {
    return this.props.assignedLoanProductVersionId;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toProps(): Readonly<LoanApplicationProps> {
    return { ...this.props, propertiesOwned: [...this.props.propertiesOwned], submittedDocuments: [...this.props.submittedDocuments] };
  }

  /** Staff picks the specific product sub-type during review — required before `approve()`. */
  assignProduct(loanProductVersionId: string): void {
    this.props.assignedLoanProductVersionId = loanProductVersionId;
    this.props.updatedAt = new Date();
  }

  /** Risk-input fields (Detail page's AI Risk Management Summary) — editable only while no human
   * decision has been made yet (2026-07-14: previously had no status guard at all, so these could
   * still be edited on an already-APPROVED/DECLINED application). Only the provided fields are
   * touched. Does not itself recompute `status` — the calling use case re-runs
   * LoanApplicationPreQualificationService and calls `applySystemClassification()` separately. */
  updateApplicantFinancials(patch: { monthlyIncome?: number; creditScore?: number; propertiesOwned?: string[] }): void {
    if (this.props.status !== 'PREAPPROVED' && this.props.status !== 'PREDECLINED') {
      throw new InvalidLoanApplicationTransitionError(this.props.status, 'edit');
    }
    if (patch.monthlyIncome !== undefined) this.props.monthlyIncome = patch.monthlyIncome;
    if (patch.creditScore !== undefined) this.props.creditScore = patch.creditScore;
    if (patch.propertiesOwned !== undefined) this.props.propertiesOwned = patch.propertiesOwned;
    this.props.updatedAt = new Date();
  }

  /** Re-applies a freshly computed system verdict — only valid while no human decision exists yet
   * (i.e. `status` is still PREAPPROVED/PREDECLINED). No-ops silently once APPROVED/DECLINED, so
   * callers don't need their own guard for "has this already been decided?" before calling it. */
  applySystemClassification(result: { status: 'PREAPPROVED' | 'PREDECLINED'; distanceFromBranchKm: number | null }): void {
    if (this.props.status !== 'PREAPPROVED' && this.props.status !== 'PREDECLINED') return;
    this.props.status = result.status;
    this.props.distanceFromBranchKm = result.distanceFromBranchKm ?? undefined;
    this.props.updatedAt = new Date();
  }

  approve(reviewedByUserId: string, decisionNote: string | undefined): void {
    if (this.props.status !== 'PREAPPROVED' && this.props.status !== 'PREDECLINED') {
      throw new InvalidLoanApplicationTransitionError(this.props.status, 'approve');
    }
    if (!this.props.assignedLoanProductVersionId) {
      throw new ProductNotAssignedError();
    }
    this.props.status = 'APPROVED';
    this.props.reviewedByUserId = reviewedByUserId;
    this.props.reviewedAt = new Date();
    this.props.decisionNote = decisionNote;
    this.props.updatedAt = new Date();
  }

  decline(reviewedByUserId: string, decisionNote: string | undefined): void {
    if (this.props.status !== 'PREAPPROVED' && this.props.status !== 'PREDECLINED') {
      throw new InvalidLoanApplicationTransitionError(this.props.status, 'decline');
    }
    this.props.status = 'DECLINED';
    this.props.reviewedByUserId = reviewedByUserId;
    this.props.reviewedAt = new Date();
    this.props.decisionNote = decisionNote;
    this.props.updatedAt = new Date();
  }

  /** MIS-only in the mock UI — enforced by the controller's role check, not here (this entity has
   * no concept of roles). `targetStatus` is a freshly recomputed system verdict (the calling use
   * case re-runs LoanApplicationPreQualificationService) rather than a memorized old value, so
   * revert always reflects current data. */
  revert(targetStatus: 'PREAPPROVED' | 'PREDECLINED'): void {
    if (this.props.status === 'PREAPPROVED' || this.props.status === 'PREDECLINED') {
      throw new InvalidLoanApplicationTransitionError(this.props.status, 'revert');
    }
    this.props.status = targetStatus;
    this.props.reviewedByUserId = undefined;
    this.props.reviewedAt = undefined;
    this.props.decisionNote = undefined;
    this.props.updatedAt = new Date();
  }
}

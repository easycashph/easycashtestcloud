import { randomUUID } from 'node:crypto';
import { InvalidLoanApplicationTransitionError, ProductNotAssignedError } from './errors/LoanApplicationDomainErrors';

/** PREAPPROVED/PREDECLINED are computed by LoanApplicationPreQualificationService — advisory only.
 * From PREAPPROVED, a CRM/MIS/Loan Operation Manager user starts a manual review (UNDER_REVIEW),
 * tags it PRE_APPROVAL once the Review Report is complete, and only then can MIS/Loan Operation
 * Manager give the final APPROVED/DECLINED call (2026-07-16, Under Review / Pre Approval stages). */
export type LoanApplicationStatus = 'PREAPPROVED' | 'PREDECLINED' | 'UNDER_REVIEW' | 'PRE_APPROVAL' | 'APPROVED' | 'DECLINED';
export type LoanApplicationAccountType = 'NEW' | 'RENEWAL';
export type CreditBureauResult = 'CLEAR' | 'FLAGGED' | 'NO_RECORD_FOUND';

export interface DependantEntry {
  name: string;
  age?: string;
  relationship?: string;
}

/** 2026-07-21 (Credit Evaluation Report redesign) — CMAP/KYC/Myscore, captured separately per
 * party since the legacy CER template checks both the borrower and co-borrower independently. */
export interface CreditBureauPartyCheck {
  cmap?: string;
  kyc?: string;
  myscore?: string;
}

/** 2026-07-21 (user request) — per-document underwriter verification, replacing the old plain
 * `checkedDocuments` checkbox (checked = verified, nothing else representable). `reason` is only
 * meaningful for REJECTED (e.g. "Only 1 month submitted - needs resubmission"). Keyed by the
 * document name as it appears in `submittedDocuments`. */
export type DocumentVerificationStatus = 'VERIFIED' | 'REJECTED';
export interface DocumentVerificationEntry {
  status: DocumentVerificationStatus;
  reason?: string;
}

/** 2026-07-21 — "Mode of Payment and Mitigation" from the legacy CER: an optional ATM/allotment
 * surrender arrangement, not applicable to every loan.
 *
 * 2026-07-29: `accountOwner` added - whose name this bank/ATM account is under. Required whenever
 * any of the other mitigation fields are filled AND the application has a co-borrower - it's the
 * source of truth `CreateLoanSigningSessionUseCase` reads (via `LoanAccount.sourceApplicationId`)
 * to decide whether "Deed of Assignment - Co-Borrower" belongs in the co-borrower's signing batch:
 * that form only applies when the surrendered account is actually the co-borrower's, not simply
 * because a co-borrower exists on the loan. */
export interface MitigationDetails {
  bank?: string;
  branch?: string;
  accountName?: string;
  accountNumber?: string;
  atmCardNumber?: string;
  allotmentAmount?: string;
  accountOwner?: 'BORROWER' | 'CO_BORROWER';
}

/** 2026-07-21 — Agency/contract/allotment verification from the legacy CER, required only for
 * Seafarer Loan applications (enforced in `TagLoanApplicationPreApprovalUseCase`, not here — this
 * entity has no concept of "which product is Seafarer", same reasoning as the role checks noted on
 * `revert()` below). */
export interface AgencyVerificationDetails {
  agencyName?: string;
  agencyAddress?: string;
  agencyContactNumbers?: string;
  yearsWithAgency?: string;
  basicMonthlySalary?: string;
  position?: string;
  vessel?: string;
  contractDuration?: string;
  joiningPort?: string;
  dateOfDeparture?: string;
  departureStatus?: string;
  expectedSignOffDate?: string;
  monthlySalary?: string;
  allottee1Name?: string;
  allottee1Bank?: string;
  allottee1AccountNumber?: string;
  allottee1Amount?: string;
  allottee2Name?: string;
  allottee2Bank?: string;
  allottee2AccountNumber?: string;
  allottee2Amount?: string;
  payrollSchedule?: string;
  firstFullAllotmentDate?: string;
  cashAdvance?: string;
  mannerOfDeduction?: string;
  sourceName?: string;
  sourcePosition?: string;
}

/** 2026-07-16 (Under Review / Pre Approval stages) — CI/Credit Bureau/document-checklist findings
 * captured while UNDER_REVIEW. `checkedDocuments` holds the subset of `submittedDocuments` the
 * reviewer has verified, not an independent list.
 *
 * 2026-07-21 — redesigned against the legacy Credit Evaluation Report (CER) template
 * (`legacy/reports/Credit Evaluation Report Template/CER.docx`): `creditBureauResult`/
 * `creditBureauScore` are kept only for backward compatibility with reports saved before this date
 * — the new UI writes `creditBureauBorrower`/`creditBureauCoBorrower` instead, matching the CER's
 * per-party CMAP/KYC/Myscore breakdown. `ciNotes` is likewise kept for old data; the new UI writes
 * `conditionsForApproval`/`crmRecommendation` instead, the CER's two distinct narrative fields. */
export interface ReviewReport {
  ciNotes?: string;
  creditBureauResult?: CreditBureauResult;
  creditBureauScore?: string;
  checkedDocuments: string[];
  /** Keyed by document name - see the type's own doc comment. Supersedes `checkedDocuments` for
   * the new UI; that field is kept only for backward compatibility with reports saved before this
   * date. */
  documentVerifications?: Record<string, DocumentVerificationEntry>;
  documentsVerifiedByUserId?: string;
  documentsVerifiedAt?: string;
  creditBureauBorrower?: CreditBureauPartyCheck;
  creditBureauCoBorrower?: CreditBureauPartyCheck;
  mitigation?: MitigationDetails;
  agencyVerification?: AgencyVerificationDetails;
  conditionsForApproval?: string;
  crmRecommendation?: string;
}

export interface LoanApplicationProps {
  id: string;
  branchId: string;
  /** Set only when this application was created FROM an existing client's profile (renewal flow)
   * - see schema.prisma's LoanApplication.borrowerId doc comment for the full explanation. */
  borrowerId?: string;
  /** Set when submitted through the Easycash Portal - see schema.prisma's doc comment. */
  portalAccountId?: string;

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
  /** 2026-08-27 (user request) - present address only, matches the paper form's own scope. */
  presentAddressLengthOfStayMonths?: number;
  /** 2026-07-22 - captured only at intake (create form), like the present-address fields above;
   * never edited afterward. Defaults true - most applicants haven't moved. When false, the
   * `previous*` fields below hold a distinct address, same flat-field shape as present address. */
  previousAddressSameAsPresent: boolean;
  previousAddress?: string;
  previousHouseUnitNumber?: string;
  previousStreet?: string;
  previousBarangay?: string;
  previousCityMunicipality?: string;
  previousProvince?: string;
  previousZipCode?: string;
  monthlyIncome?: number;
  employer?: string;
  occupation?: string;
  officeAddress?: string;
  tinNumber?: string;
  sssNumber?: string;
  propertiesOwned: string[];
  creditScore?: number;
  coBorrowerName?: string;
  coBorrowerFirstName?: string;
  coBorrowerMiddleName?: string;
  coBorrowerLastName?: string;
  coBorrowerEmployer?: string;
  coBorrowerContactNumber?: string;
  coBorrowerEmail?: string;
  coBorrowerAddress?: string;
  mobilePhone?: string;
  email?: string;
  facebookLink?: string;
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
  /** 2026-07-24 — the applicant's device GPS coordinates at submission time (portal only,
   * optional/best-effort). See schema.prisma's doc comment. */
  submissionLatitude?: number;
  submissionLongitude?: number;
  assignedLoanProductVersionId?: string;

  reviewedByUserId?: string;
  reviewedAt?: Date;
  decisionNote?: string;

  reviewStartedByUserId?: string;
  reviewStartedAt?: Date;
  reviewReport?: ReviewReport;
  preApprovedByUserId?: string;
  preApprovedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLoanApplicationProps {
  branchId: string;
  borrowerId?: string;
  portalAccountId?: string;
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
  presentAddressLengthOfStayMonths?: number;
  previousAddressSameAsPresent?: boolean;
  previousAddress?: string;
  previousHouseUnitNumber?: string;
  previousStreet?: string;
  previousBarangay?: string;
  previousCityMunicipality?: string;
  previousProvince?: string;
  previousZipCode?: string;
  monthlyIncome?: number;
  employer?: string;
  occupation?: string;
  officeAddress?: string;
  tinNumber?: string;
  sssNumber?: string;
  propertiesOwned?: string[];
  creditScore?: number;
  coBorrowerName?: string;
  coBorrowerFirstName?: string;
  coBorrowerMiddleName?: string;
  coBorrowerLastName?: string;
  coBorrowerEmployer?: string;
  coBorrowerContactNumber?: string;
  coBorrowerEmail?: string;
  coBorrowerAddress?: string;
  mobilePhone?: string;
  email?: string;
  facebookLink?: string;
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
  submissionLatitude?: number;
  submissionLongitude?: number;
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
      portalAccountId: input.portalAccountId,
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
      presentAddressLengthOfStayMonths: input.presentAddressLengthOfStayMonths,
      previousAddressSameAsPresent: input.previousAddressSameAsPresent ?? true,
      previousAddress: input.previousAddress,
      previousHouseUnitNumber: input.previousHouseUnitNumber,
      previousStreet: input.previousStreet,
      previousBarangay: input.previousBarangay,
      previousCityMunicipality: input.previousCityMunicipality,
      previousProvince: input.previousProvince,
      previousZipCode: input.previousZipCode,
      monthlyIncome: input.monthlyIncome,
      employer: input.employer,
      occupation: input.occupation,
      officeAddress: input.officeAddress,
      tinNumber: input.tinNumber,
      sssNumber: input.sssNumber,
      propertiesOwned: input.propertiesOwned ?? [],
      creditScore: input.creditScore,
      coBorrowerName: input.coBorrowerName,
      coBorrowerFirstName: input.coBorrowerFirstName,
      coBorrowerMiddleName: input.coBorrowerMiddleName,
      coBorrowerLastName: input.coBorrowerLastName,
      coBorrowerEmployer: input.coBorrowerEmployer,
      coBorrowerContactNumber: input.coBorrowerContactNumber,
      coBorrowerEmail: input.coBorrowerEmail,
      coBorrowerAddress: input.coBorrowerAddress,
      mobilePhone: input.mobilePhone,
      email: input.email,
      facebookLink: input.facebookLink,
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
      submissionLatitude: input.submissionLatitude,
      submissionLongitude: input.submissionLongitude,
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

  /** Added 2026-07-17 for the Notification Center's title text (e.g. "New loan application: Jane
   * Doe") - use cases that only have an `id` (not the original create `input`) need this to build
   * a readable notification without a second DB round-trip. */
  get applicantName(): string {
    return this.props.applicantName;
  }

  /** Added 2026-07-17 for the Notification Center - who to notify when this application is
   * decided (the officer who originally encoded it, if any - the public application intake has no
   * encoder). */
  get encodedByUserId(): string | undefined {
    return this.props.encodedByUserId;
  }

  get borrowerId(): string | undefined {
    return this.props.borrowerId;
  }

  get portalAccountId(): string | undefined {
    return this.props.portalAccountId;
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

  get reviewReport(): ReviewReport | undefined {
    return this.props.reviewReport;
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

  /** 2026-07-24 (user request) — lets the Easycash Portal client who submitted this application
   * correct anything on it (typos, an address that changed, etc.) up until a human starts
   * reviewing it. Same "no decision made yet" guard as updateApplicantFinancials above, just over
   * the full self-service field set instead of only the 3 risk-input fields - branchId/status/id/
   * portalAccountId/borrowerId/encodedByUserId/review-and-decision fields are deliberately NOT
   * part of this patch shape, so they can never be touched through this path regardless of what a
   * caller sends. Only the provided fields are touched (PATCH semantics, matching
   * updateApplicantFinancials' own convention) - does not itself recompute `status`, same reasoning
   * as that method. */
  updateSelfServiceIntake(
    patch: Partial<
      Pick<
        LoanApplicationProps,
        | 'applicantName'
        | 'age'
        | 'gender'
        | 'civilStatus'
        | 'birthDate'
        | 'placeOfBirth'
        | 'nationality'
        | 'homeOwnership'
        | 'address'
        | 'houseUnitNumber'
        | 'street'
        | 'barangay'
        | 'cityMunicipality'
        | 'province'
        | 'zipCode'
        | 'previousAddressSameAsPresent'
        | 'previousAddress'
        | 'previousHouseUnitNumber'
        | 'previousStreet'
        | 'previousBarangay'
        | 'previousCityMunicipality'
        | 'previousProvince'
        | 'previousZipCode'
        | 'monthlyIncome'
        | 'employer'
        | 'occupation'
        | 'officeAddress'
        | 'tinNumber'
        | 'sssNumber'
        | 'coBorrowerName'
        | 'coBorrowerFirstName'
        | 'coBorrowerMiddleName'
        | 'coBorrowerLastName'
        | 'coBorrowerEmployer'
        | 'coBorrowerContactNumber'
        | 'coBorrowerEmail'
        | 'coBorrowerAddress'
        | 'mobilePhone'
        | 'email'
        | 'facebookLink'
        | 'dependants'
        | 'reference1Name'
        | 'reference1Mobile'
        | 'reference2Name'
        | 'reference2Mobile'
        | 'note'
        | 'referralSource'
        | 'accountType'
        | 'loanPurpose'
        | 'requestedCategory'
        | 'requestedAmount'
        | 'requestedTermMonths'
      >
    >,
  ): void {
    if (this.props.status !== 'PREAPPROVED' && this.props.status !== 'PREDECLINED') {
      throw new InvalidLoanApplicationTransitionError(this.props.status, 'edit');
    }
    for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
      const value = patch[key];
      if (value !== undefined) (this.props as unknown as Record<string, unknown>)[key] = value;
    }
    this.props.updatedAt = new Date();
  }

  /** 2026-08-12 (user request/bug fix) — lets LMS staff (MIS/Loan Operation Manager/CRM) correct the
   * full intake field set on an application THEY encoded, mirroring updateSelfServiceIntake's patch
   * shape exactly but with a wider status guard: PREAPPROVED/PREDECLINED/UNDER_REVIEW, not just the
   * pre-review pair. Widened specifically because staff-encoded applications are the ones most often
   * needing a correction discovered mid-review (a mistyped address, a missed reference number), and
   * locking edits the moment Start Review is clicked left no way to fix them without a revert. Still
   * closed once PRE_APPROVAL/APPROVED/DECLINED — by then the Review Report is the record of what was
   * evaluated, so further intake edits would silently invalidate a already-made decision context. */
  updateStaffIntake(patch: Parameters<LoanApplication['updateSelfServiceIntake']>[0]): void {
    if (this.props.status !== 'PREAPPROVED' && this.props.status !== 'PREDECLINED' && this.props.status !== 'UNDER_REVIEW') {
      throw new InvalidLoanApplicationTransitionError(this.props.status, 'edit');
    }
    for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
      const value = patch[key];
      if (value !== undefined) (this.props as unknown as Record<string, unknown>)[key] = value;
    }
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

  /** 2026-07-17 (Milestone C): narrowed to PRE_APPROVAL-only - an application must go through
   * Start Review -> Tag Pre Approval before the final Approve is reachable. Previously accepted
   * PREAPPROVED/PREDECLINED directly (Milestone A/B kept that path open while the review routes
   * and UI didn't exist yet). */
  approve(reviewedByUserId: string, decisionNote: string | undefined): void {
    if (this.props.status !== 'PRE_APPROVAL') {
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

  /** 2026-07-16: widened to allow declining from any of the four pre-decision stages, not just the
   * system's initial PREAPPROVED/PREDECLINED verdict - a Credit Bureau flag or failed CI can
   * surface mid-review just as easily as at intake. */
  decline(reviewedByUserId: string, decisionNote: string | undefined): void {
    if (
      this.props.status !== 'PREAPPROVED' &&
      this.props.status !== 'PREDECLINED' &&
      this.props.status !== 'UNDER_REVIEW' &&
      this.props.status !== 'PRE_APPROVAL'
    ) {
      throw new InvalidLoanApplicationTransitionError(this.props.status, 'decline');
    }
    this.props.status = 'DECLINED';
    this.props.reviewedByUserId = reviewedByUserId;
    this.props.reviewedAt = new Date();
    this.props.decisionNote = decisionNote;
    this.props.updatedAt = new Date();
  }

  /** CRM/MIS/Loan Operation Manager clicks "Start Review": PREAPPROVED/PREDECLINED -> UNDER_REVIEW.
   * 2026-08-12 (user request/bug fix): PREDECLINED is the system's own advisory pre-screening
   * verdict (see applySystemClassification above), not a human decision - it exists to help sort/
   * filter the application list, not to block a loan officer from giving it a final human verdict.
   * Previously only PREAPPROVED could start review, which meant any system-flagged application was
   * stuck and unreviewable. Declining a PREDECLINED application straight away (without opening
   * review) is still independently supported via decline(). */
  startReview(startedByUserId: string): void {
    if (this.props.status !== 'PREAPPROVED' && this.props.status !== 'PREDECLINED') {
      throw new InvalidLoanApplicationTransitionError(this.props.status, 'start review');
    }
    this.props.status = 'UNDER_REVIEW';
    this.props.reviewStartedByUserId = startedByUserId;
    this.props.reviewStartedAt = new Date();
    this.props.updatedAt = new Date();
  }

  /** Saves/merges the Review Report while UNDER_REVIEW - locked (throws) once the application has
   * moved on to PRE_APPROVAL/DECLINED/etc, so a stale report tab can't clobber a later stage's
   * data. Only the provided fields are touched; `checkedDocuments` merges by replacement (the
   * caller always sends the full current checklist state, same PATCH convention as
   * updateApplicantFinancials). */
  updateReviewReport(patch: Partial<ReviewReport>): void {
    if (this.props.status !== 'UNDER_REVIEW') {
      throw new InvalidLoanApplicationTransitionError(this.props.status, 'edit review report');
    }
    const current = this.props.reviewReport ?? { checkedDocuments: [] };
    this.props.reviewReport = { ...current, ...patch };
    this.props.updatedAt = new Date();
  }

  /** 2026-07-29 - deliberately NOT gated by the UNDER_REVIEW check `updateReviewReport()` enforces
   * above. `mitigation.accountOwner` is read by `CreateLoanSigningSessionUseCase` (via
   * `LoanAccount.sourceApplicationId`) for loans that are already ACTIVE - long past UNDER_REVIEW -
   * so it must stay settable for the lifetime of the loan, unlike every other Review Report field
   * (which the surrounding lock exists specifically to freeze once a later stage has moved on).
   * Merges into whatever `mitigation` already exists rather than replacing it, so this narrow
   * update can never clobber the other mitigation fields (bank/branch/account number/etc). */
  setMitigationAccountOwner(accountOwner: 'BORROWER' | 'CO_BORROWER'): void {
    const current = this.props.reviewReport ?? { checkedDocuments: [] };
    this.props.reviewReport = { ...current, mitigation: { ...current.mitigation, accountOwner } };
    this.props.updatedAt = new Date();
  }

  /** 2026-08-10 (user request) - generalizes `setMitigationAccountOwner` above to every mitigation
   * field (bank/branch/accountName/accountNumber/atmCardNumber/allotmentAmount/accountOwner), same
   * "NOT gated by UNDER_REVIEW" reasoning: MIS/CRM need to correct a surrendered ATM/allotment
   * account's details even after the loan is already ACTIVE (e.g. a typo caught after approval),
   * not just the accountOwner sub-field. Same merge-not-replace semantics. */
  setMitigationDetails(patch: Partial<MitigationDetails>): void {
    const current = this.props.reviewReport ?? { checkedDocuments: [] };
    this.props.reviewReport = { ...current, mitigation: { ...current.mitigation, ...patch } };
    this.props.updatedAt = new Date();
  }

  /** CRM/MIS/Loan Operation Manager "Tags as Pre Approval" once the Review Report is complete:
   * UNDER_REVIEW -> PRE_APPROVAL. The report itself becomes implicitly locked from here on, since
   * updateReviewReport() only accepts UNDER_REVIEW. */
  tagPreApproval(taggedByUserId: string): void {
    if (this.props.status !== 'UNDER_REVIEW') {
      throw new InvalidLoanApplicationTransitionError(this.props.status, 'tag pre approval');
    }
    this.props.status = 'PRE_APPROVAL';
    this.props.preApprovedByUserId = taggedByUserId;
    this.props.preApprovedAt = new Date();
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

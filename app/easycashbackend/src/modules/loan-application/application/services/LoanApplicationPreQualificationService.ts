import type { IGeocodingService } from '@shared/geo/IGeocodingService';
import { haversineDistanceKm } from '@shared/geo/haversineDistanceKm';
import type { IBranchRepository } from '../ports/IBranchRepository';
import { computeFlatRateAmortization, getMonthlyFlatRate } from '../config/loanCategoryFlatRates';

const MIN_AGE = 18;
const MAX_AGE = 55;

export interface PreQualificationInput {
  branchId: string;
  age: number | undefined;
  monthlyIncome: number | undefined;
  requestedAmount: number;
  requestedTermMonths: number;
  requestedCategory: string;
  /** The applicant's already-joined address string (same shape the intake form submits as
   * `address`) - geocoded fresh each time this runs (no per-application caching of the applicant's
   * own coordinates; only the resulting `distanceFromBranchKm` is cached on the entity). Kept for
   * the Detail page's informational "X km from branch" header line - no longer a decision-scoring
   * check (see PreQualificationBreakdown's `checks.employment` doc comment). */
  applicantAddressText: string | undefined;
  occupation: string | undefined;
  employer: string | undefined;
}

export interface PreQualificationResult {
  status: 'PREAPPROVED' | 'PREDECLINED';
  distanceFromBranchKm: number | null;
  /** Same value as PreQualificationBreakdown.estimatedMonthlyAmortization - surfaced here too
   * (2026-09-12, DTI risk-tier feature) so CreateLoanApplicationUseCase can compute an applicant's
   * DTI at submission time without a second call into evaluateCriteria. */
  estimatedMonthlyAmortization: number;
}

export interface PreQualificationCheck {
  passed: boolean;
  label: string;
  /** Human-readable explanation of the actual numbers behind the pass/fail - shown on the Detail
   * page's decision-scoring breakdown so the officer can see exactly why the system landed on
   * PREAPPROVED/PREDECLINED, not just the final verdict. */
  detail: string;
}

export interface PreQualificationBreakdown {
  status: 'PREAPPROVED' | 'PREDECLINED';
  checks: {
    age: PreQualificationCheck;
    income: PreQualificationCheck;
    /** 2026-09-09 (user request): replaced the old `distance` (address proximity to branch) check
     * - that rule almost never had real data to evaluate (free Nominatim geocoding rarely resolves
     * informal Philippine barangay addresses, so it was "could not be verified - treated as
     * passing" on nearly every application, never actually informative). Employment/occupation is
     * captured at intake on every application and is a real, always-available signal. */
    employment: PreQualificationCheck;
  };
  /** Same estimate the income check's own `detail` text already describes in words - exposed as a
   * raw number too (2026-07-20, Underwriting rework) so the Detail page can compute a Debt-to-
   * Income ratio without parsing it back out of that sentence. */
  estimatedMonthlyAmortization: number;
}

/**
 * Advisory-only system pre-classification - never an autonomous approval/decline. All three rules
 * (age, income vs. requested loan, employment/occupation on record) must pass for PREAPPROVED; any
 * failure, including missing/unknown data, is PREDECLINED.
 */
export class LoanApplicationPreQualificationService {
  constructor(
    private readonly deps: {
      branchRepository: IBranchRepository;
      geocodingService: IGeocodingService;
    },
  ) {}

  async classify(input: PreQualificationInput): Promise<PreQualificationResult> {
    // Still resolved and stored for the Detail page's informational "X km from branch" header
    // line - just no longer fed into evaluateCriteria below (see checks.employment's doc comment).
    const distanceFromBranchKm = await this.resolveDistanceKm(input.branchId, input.applicantAddressText);
    const breakdown = this.evaluateCriteria(input);
    return { status: breakdown.status, distanceFromBranchKm, estimatedMonthlyAmortization: breakdown.estimatedMonthlyAmortization };
  }

  /**
   * Pure, no I/O - re-evaluates the same three rules from already-known inputs so the Detail page
   * can show a live "why" breakdown on every read without an extra network call.
   */
  evaluateCriteria(input: {
    age: number | undefined;
    monthlyIncome: number | undefined;
    requestedAmount: number;
    requestedTermMonths: number;
    requestedCategory: string;
    occupation: string | undefined;
    employer: string | undefined;
  }): PreQualificationBreakdown {
    const ageOk = input.age !== undefined && input.age >= MIN_AGE && input.age <= MAX_AGE;
    const ageCheck: PreQualificationCheck = {
      passed: ageOk,
      label: 'Age',
      detail:
        input.age === undefined
          ? 'Age not on record.'
          : `Age ${input.age} - requires ${MIN_AGE}–${MAX_AGE}.`,
    };

    const amortization = computeFlatRateAmortization(input.requestedAmount, input.requestedTermMonths, input.requestedCategory);
    const incomeOk = input.monthlyIncome !== undefined && input.monthlyIncome > amortization;
    const monthlyFlatRatePercent = (getMonthlyFlatRate(input.requestedCategory) * 100).toFixed(2);
    const incomeCheck: PreQualificationCheck = {
      passed: incomeOk,
      label: 'Monthly income vs. loan amount',
      detail:
        input.monthlyIncome === undefined
          ? `Monthly income not yet recorded - needs to exceed the estimated ₱${amortization.toFixed(2)}/month amortization (${monthlyFlatRatePercent}% flat rate).`
          : `Monthly income ₱${input.monthlyIncome.toFixed(2)} vs. estimated ₱${amortization.toFixed(2)}/month amortization.`,
    };

    const occupation = input.occupation?.trim();
    const employer = input.employer?.trim();
    const employmentOk = Boolean(occupation) || Boolean(employer);
    const employmentCheck: PreQualificationCheck = {
      passed: employmentOk,
      label: 'Employment / occupation',
      detail: employmentOk
        ? `${occupation || 'Occupation not specified'}${employer ? ` at ${employer}` : ''}.`
        : 'No occupation or employer on record.',
    };

    return {
      status: ageCheck.passed && incomeCheck.passed && employmentCheck.passed ? 'PREAPPROVED' : 'PREDECLINED',
      checks: { age: ageCheck, income: incomeCheck, employment: employmentCheck },
      estimatedMonthlyAmortization: amortization,
    };
  }

  private async resolveDistanceKm(branchId: string, applicantAddressText: string | undefined): Promise<number | null> {
    if (!applicantAddressText?.trim()) return null;

    const branch = await this.deps.branchRepository.findById(branchId);
    if (!branch) return null;

    let branchCoordinates =
      branch.latitude !== null && branch.longitude !== null ? { latitude: branch.latitude, longitude: branch.longitude } : null;

    if (!branchCoordinates && branch.address) {
      branchCoordinates = await this.deps.geocodingService.geocode(branch.address);
      if (branchCoordinates) {
        await this.deps.branchRepository.updateCoordinates(branchId, branchCoordinates.latitude, branchCoordinates.longitude);
      }
    }
    if (!branchCoordinates) return null;

    const applicantCoordinates = await this.deps.geocodingService.geocode(applicantAddressText);
    if (!applicantCoordinates) return null;

    return Math.round(haversineDistanceKm(branchCoordinates, applicantCoordinates) * 100) / 100;
  }
}

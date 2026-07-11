import type { IGeocodingService } from '@shared/geo/IGeocodingService';
import { haversineDistanceKm } from '@shared/geo/haversineDistanceKm';
import type { IBranchRepository } from '../ports/IBranchRepository';
import { computeFlatRateAmortization } from '../config/loanCategoryFlatRates';

const MIN_AGE = 18;
const MAX_AGE = 55;
const MAX_DISTANCE_KM = 50;

export interface PreQualificationInput {
  branchId: string;
  age: number | undefined;
  monthlyIncome: number | undefined;
  requestedAmount: number;
  requestedTermMonths: number;
  requestedCategory: string;
  /** The applicant's already-joined address string (same shape the intake form submits as
   * `address`) — geocoded fresh each time this runs (no per-application caching of the applicant's
   * own coordinates; only the resulting `distanceFromBranchKm` is cached on the entity). */
  applicantAddressText: string | undefined;
}

export interface PreQualificationResult {
  status: 'PREAPPROVED' | 'PREDECLINED';
  distanceFromBranchKm: number | null;
}

/**
 * Advisory-only system pre-classification — never an autonomous approval/decline. All three rules
 * must pass for PREAPPROVED; any failure (including missing/unknown data) is PREDECLINED, except
 * the distance rule, which fails OPEN (treated as passing) when geocoding can't resolve an address,
 * since granular Philippine barangay addresses are often unresolvable by free geocoding data and
 * that should not by itself sink an otherwise-qualified applicant.
 */
export class LoanApplicationPreQualificationService {
  constructor(
    private readonly deps: {
      branchRepository: IBranchRepository;
      geocodingService: IGeocodingService;
    },
  ) {}

  async classify(input: PreQualificationInput): Promise<PreQualificationResult> {
    const ageOk = input.age !== undefined && input.age >= MIN_AGE && input.age <= MAX_AGE;

    const incomeOk =
      input.monthlyIncome !== undefined &&
      input.monthlyIncome >
        computeFlatRateAmortization(input.requestedAmount, input.requestedTermMonths, input.requestedCategory);

    const distanceFromBranchKm = await this.resolveDistanceKm(input.branchId, input.applicantAddressText);
    const distanceOk = distanceFromBranchKm === null || distanceFromBranchKm <= MAX_DISTANCE_KM;

    return {
      status: ageOk && incomeOk && distanceOk ? 'PREAPPROVED' : 'PREDECLINED',
      distanceFromBranchKm,
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

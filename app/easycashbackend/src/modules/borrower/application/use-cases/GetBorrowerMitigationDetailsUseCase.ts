import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanApplicationRepository } from '@modules/loan-application/application/ports/ILoanApplicationRepository';
import type { MitigationDetails } from '@modules/loan-application/domain/LoanApplication';
import type { IBorrowerRepository } from '../ports/IBorrowerRepository';

export interface GetBorrowerMitigationDetailsUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
  loanApplicationRepository: ILoanApplicationRepository;
}

export interface BorrowerMitigationDetailsResult {
  mitigation: MitigationDetails;
  /** Which application the fields above came from — Client Profile has no edit UI of its own
   * (mitigation stays editable only on the Loan Application page, per `SetMitigationDetailsUseCase`'s
   * status-unrestricted design), so staff need this to find their way to the real edit screen. */
  sourceApplicationId: string;
  sourceApplicationUpdatedAt: Date;
}

/**
 * 2026-08-13 (user request, "makikita ko ba yung atm details sa Client?"): a Borrower has no
 * mitigation fields of its own — they live on `LoanApplication.reviewReport.mitigation`, one row
 * per application. A borrower can be linked to more than one application two different ways (see
 * `LoanApplicationController.buildLinkage`'s own doc comment for the full explanation this mirrors):
 * the ORIGINAL application that created them (`Borrower.sourceApplicationId`, walk-in flow) and any
 * later ones created FROM this borrower (`LoanApplication.borrowerId`, renewal flow, "Create Loan
 * Application" on Client Profile).
 *
 * Resolves to whichever candidate application has mitigation data on file, most recently updated
 * first — same "most recent applicable record wins" convention already used for
 * `CreateLoanSigningSessionUseCase`'s Deed of Assignment routing. Returns `null` when none of the
 * borrower's applications ever had a mitigation section filled in (the common case — mitigation is
 * optional, only for a loan secured by a surrendered ATM/allotment account).
 */
export class GetBorrowerMitigationDetailsUseCase {
  constructor(private readonly deps: GetBorrowerMitigationDetailsUseCaseDeps) {}

  async execute(borrowerId: string): Promise<BorrowerMitigationDetailsResult | null> {
    const borrower = await this.deps.borrowerRepository.findById(borrowerId);
    if (!borrower) {
      throw new NotFoundError('Borrower', borrowerId);
    }

    const renewalApplications = await this.deps.loanApplicationRepository.findByBorrowerId(borrowerId);
    const originalApplication = borrower.sourceApplicationId
      ? await this.deps.loanApplicationRepository.findById(borrower.sourceApplicationId)
      : null;

    const candidates = [...renewalApplications, ...(originalApplication ? [originalApplication] : [])].filter(
      (app) => {
        const m = app.reviewReport?.mitigation;
        return m && Object.values(m).some((v) => Boolean(v));
      },
    );
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    const chosen = candidates[0]!;

    return {
      mitigation: chosen.reviewReport!.mitigation!,
      sourceApplicationId: chosen.id,
      sourceApplicationUpdatedAt: chosen.updatedAt,
    };
  }
}

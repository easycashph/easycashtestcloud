import type { IBorrowerRepository } from '@modules/borrower/application/ports/IBorrowerRepository';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { BulkExportType } from '../../domain/BulkExportJob';

export interface GetBulkExportDefaultRangeUseCaseDeps {
  borrowerRepository: IBorrowerRepository;
  loanAccountRepository: ILoanAccountRepository;
}

function firstDayOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function lastDayOfCurrentMonth(now: Date): Date {
  // Day 0 of next month = last day of this month.
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

/** MIS bulk document export (2026-08-24, user-confirmed defaults): prefills the date-range picker
 * with "first day of the month of the oldest record" through "last day of the current month" - the
 * broadest sensible range that still requires MIS to consciously narrow it, rather than defaulting
 * to something arbitrary like "last 30 days". */
export class GetBulkExportDefaultRangeUseCase {
  constructor(private readonly deps: GetBulkExportDefaultRangeUseCaseDeps) {}

  async execute(exportType: BulkExportType): Promise<{ startDate: Date; endDate: Date }> {
    const now = new Date();
    const earliest =
      exportType === 'BORROWER_ATTACHMENTS'
        ? await this.deps.borrowerRepository.findEarliestCreatedAt()
        : await this.deps.loanAccountRepository.findEarliestCreatedAt();

    return {
      startDate: firstDayOfMonth(earliest ?? now),
      endDate: lastDayOfCurrentMonth(now),
    };
  }
}

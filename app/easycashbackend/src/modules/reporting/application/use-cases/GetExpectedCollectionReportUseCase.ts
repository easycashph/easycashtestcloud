import type { DateRangeFilter, ExpectedCollectionReportRow, IReportingRepository } from '../ports/IReportingRepository';

export class GetExpectedCollectionReportUseCase {
  constructor(private readonly deps: { reportingRepository: IReportingRepository }) {}

  /** 2026-08-20 (user request): `productCodes` - multi-select filter on `LoanProduct.code`, undefined/empty means every product. */
  async execute(filter: DateRangeFilter & { branchId?: string; productCodes?: string[] }): Promise<ExpectedCollectionReportRow[]> {
    return this.deps.reportingRepository.getExpectedCollectionReport(filter);
  }
}

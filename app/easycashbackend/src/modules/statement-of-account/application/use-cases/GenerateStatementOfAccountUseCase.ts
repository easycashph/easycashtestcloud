import { randomUUID } from 'node:crypto';
import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { LoanAccountStatus } from '@modules/loan-account/domain/LoanAccount';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { Money } from '@shared/domain/Money';
import { GeneratedStatementOfAccount, type SoaPenaltyMode } from '../../domain/GeneratedStatementOfAccount';
import { formatSoaNumber } from '../../domain/formatSoaNumber';
import { LoanNotYetApprovedError } from '@modules/loan-document/domain/errors/LoanDocumentDomainErrors';
import type { IGeneratedStatementOfAccountRepository } from '../ports/IGeneratedStatementOfAccountRepository';
import type { IStatementOfAccountMergeDataResolver } from '../ports/IStatementOfAccountMergeDataResolver';
import type { IDocumentFiller } from '@modules/loan-document/application/ports/IDocumentFiller';
import type { IDocxToPdfConverter } from '@modules/loan-document/application/ports/IDocxToPdfConverter';

/** Same lifecycle gate as `GenerateLoanDocumentUseCase` — an SOA is a servicing/collection
 * document, only meaningful once the loan's terms are final (APPROVED) or the loan is actually
 * carrying a balance (ACTIVE/ACTIVE_IN_ARREARS). */
const GENERATABLE_STATUSES: LoanAccountStatus[] = ['APPROVED', 'ACTIVE', 'ACTIVE_IN_ARREARS'];

const SOA_TEMPLATE_CODE = 'SOA';

export interface GenerateStatementOfAccountUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  generatedStatementOfAccountRepository: IGeneratedStatementOfAccountRepository;
  mergeDataResolver: IStatementOfAccountMergeDataResolver;
  documentFiller: IDocumentFiller;
  docxToPdfConverter: IDocxToPdfConverter;
  fileStorage: IFileStorage;
}

export interface GenerateStatementOfAccountInput {
  loanAccountId: string;
  /**
   * 2026-08-12 (user-confirmed). `RECORDED` (the default staff choice) takes each installment's
   * penalty straight off the repayment schedule and needs no dates at all; `COMPUTED` keeps those
   * recorded figures and fills in only the installments that have none, over the range below. See
   * `StatementOfAccountCalculator`'s doc comment for the full rules.
   */
  penaltyMode: SoaPenaltyMode;
  /** Both required under `COMPUTED`, ignored otherwise — the resolver validates and throws. */
  penaltyFromDate?: Date;
  penaltyToDate?: Date;
  /** Both required under `MANUAL`, ignored otherwise. The reason is what makes a hand-set figure
   * explainable later against the schedule it disagrees with. */
  manualPenaltyAmount?: Money;
  penaltyManualReason?: string;
  /** Manually-entered "as of" date for the Accrued Interest figure — independent of the Penalty range. */
  accruedInterestAsOfDate: Date;
  collectionFee: Money;
  otherFee: Money;
  generatedByUserId: string;
}

export class GenerateStatementOfAccountUseCase {
  constructor(private readonly deps: GenerateStatementOfAccountUseCaseDeps) {}

  async execute(input: GenerateStatementOfAccountInput): Promise<GeneratedStatementOfAccount> {
    const loanAccount = await this.deps.loanAccountRepository.findById(input.loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', input.loanAccountId);
    if (!GENERATABLE_STATUSES.includes(loanAccount.status)) {
      throw new LoanNotYetApprovedError(loanAccount.status);
    }

    // 2026-07-19 (confirmed against the actual VBA source): SOA Number is a PER-LOAN-ACCOUNT
    // running counter (`SOA-#####-MMDDYYYY`, matches `wsLoan.Cells(r, 26)` in the legacy tool),
    // read BEFORE generating the PDF since it's a placeholder on the document itself — same "max
    // existing + 1" pattern as `CreateLoanAccountUseCase.generateLoanCode` (non-atomic, accepted
    // for this low-frequency, staff-driven action; see `soaSequenceNumber`'s own doc comment in
    // schema.prisma).
    const soaSequenceNumber = (await this.deps.generatedStatementOfAccountRepository.findMaxSoaSequenceNumber(input.loanAccountId)) + 1;
    const statementDate = new Date();
    const soaNumber = formatSoaNumber(soaSequenceNumber, statementDate);
    const { mergeData, figures, effectivePenaltyFromDate, effectivePenaltyToDate } = await this.deps.mergeDataResolver.resolve(
      input.loanAccountId,
      soaNumber,
      statementDate,
      input.penaltyMode,
      input.penaltyFromDate,
      input.penaltyToDate,
      input.manualPenaltyAmount,
      input.accruedInterestAsOfDate,
      input.collectionFee,
      input.otherFee,
    );
    const totalAmountDue = figures.totalPastDue
      .add(figures.currentAmortizationDue)
      .add(figures.accruedInterest)
      .add(input.collectionFee)
      .add(input.otherFee);

    const filledDocx = await this.deps.documentFiller.fill(SOA_TEMPLATE_CODE, mergeData);
    const pdfBuffer = await this.deps.docxToPdfConverter.convert(filledDocx);

    const storageKey = `statements-of-account/${input.loanAccountId}/${randomUUID()}.pdf`;
    await this.deps.fileStorage.save(storageKey, pdfBuffer);

    const statement = GeneratedStatementOfAccount.create({
      loanAccountId: input.loanAccountId,
      soaSequenceNumber,
      penaltyMode: input.penaltyMode,
      penaltyFromDate: effectivePenaltyFromDate,
      penaltyToDate: effectivePenaltyToDate,
      penaltyManualReason: input.penaltyMode === 'MANUAL' ? input.penaltyManualReason?.trim() ?? null : null,
      accruedInterestAsOfDate: input.accruedInterestAsOfDate,
      currentAmortizationDue: figures.currentAmortizationDue,
      pastDuePrincipal: figures.pastDuePrincipal,
      pastDueInterest: figures.pastDueInterest,
      pastDuePenalty: figures.pastDuePenalty,
      totalPastDue: figures.totalPastDue,
      accruedInterest: figures.accruedInterest,
      collectionFee: input.collectionFee,
      otherFee: input.otherFee,
      totalAmountDue,
      storageKey,
      generatedByUserId: input.generatedByUserId,
      generatedAt: statementDate,
    });
    await this.deps.generatedStatementOfAccountRepository.create(statement);

    return statement;
  }
}

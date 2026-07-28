import { randomUUID } from 'node:crypto';
import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { LoanAccountStatus } from '@modules/loan-account/domain/LoanAccount';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { Money } from '@shared/domain/Money';
import { GeneratedStatementOfAccount } from '../../domain/GeneratedStatementOfAccount';
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
   * Manually-entered date range applied uniformly across every Past Due installment for the
   * Penalty computation (2026-07-19, user request — see `StatementOfAccountCalculator`'s own doc
   * comment). 2026-07-28: only required for a migrated loan now — a prospective loan's Penalty
   * line is live-computed (`ADR-050` via `resolveComputedPenalty`) and ignores this entirely; the
   * resolver validates presence for a migrated loan and throws if omitted.
   */
  penaltyFromDate?: Date;
  penaltyToDate: Date;
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
    const { mergeData, figures, effectivePenaltyFromDate } = await this.deps.mergeDataResolver.resolve(
      input.loanAccountId,
      soaNumber,
      statementDate,
      input.penaltyFromDate,
      input.penaltyToDate,
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
      penaltyFromDate: effectivePenaltyFromDate,
      penaltyToDate: input.penaltyToDate,
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

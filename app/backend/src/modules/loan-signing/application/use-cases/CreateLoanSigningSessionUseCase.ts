import { NotFoundError } from '@shared/errors/DomainError';
import { env } from '@shared/config/env';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { IDocumentTemplateRepository } from '@modules/loan-document/application/ports/IDocumentTemplateRepository';
import type { IGeneratedLoanDocumentRepository } from '@modules/loan-document/application/ports/IGeneratedLoanDocumentRepository';
import type { GenerateLoanDocumentUseCase } from '@modules/loan-document/application/use-cases/GenerateLoanDocumentUseCase';
import type { ISmsGateway } from '@modules/sms-reminder/application/ports/ISmsGateway';
import type { ICoBorrowerRepository } from '@modules/borrower/application/ports/ICoBorrowerRepository';
import { LoanSigningSession, type SigningPartyType } from '../../domain/LoanSigningSession';
import {
  NoCoBorrowerLinkedError,
  NoDocumentsForPartyError,
  NoRequiredDocumentTemplatesError,
} from '../../domain/errors/LoanSigningDomainErrors';
import type { ILoanSigningSessionRepository } from '../ports/ILoanSigningSessionRepository';
import { generateSigningToken, hashSigningSecret } from '../../infrastructure/signingTokenHash';

const SESSION_TTL_DAYS = 7;

export interface CreateLoanSigningSessionUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanProductRepository: ILoanProductRepository;
  documentTemplateRepository: IDocumentTemplateRepository;
  generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
  generateLoanDocumentUseCase: GenerateLoanDocumentUseCase;
  loanSigningSessionRepository: ILoanSigningSessionRepository;
  coBorrowerRepository: ICoBorrowerRepository;
  smsGateway: ISmsGateway;
}

/**
 * 2026-07-22 (e-signature). Batches every applicable `DocumentTemplate` - REQUIRED plus whichever
 * CONDITIONAL templates are mapped to this loan account's specific product (via
 * `DocumentTemplateMapping`) - into one signing session, filtered to whichever party this batch is
 * for (2026-07-25: `partyType` - `requiresBorrowerSignature`/`requiresCoBorrowerSignature` on each
 * template decides membership; a template needing both parties appears in BOTH batches, using the
 * SAME underlying `GeneratedLoanDocument`, so the co-borrower's signature lands on the SAME PDF the
 * borrower already signed - see `SignLoanSigningDocumentUseCase`). Generates any document that
 * doesn't already have a `GeneratedLoanDocument` on file yet (reuses the same
 * `GenerateLoanDocumentUseCase` the Documents tab's "Generate" button calls), then sends a single
 * SMS with the signing link - one link, one OTP verification, every document in the batch signed
 * in the same visit.
 *
 * For a CO_BORROWER batch, `phoneNumber` is staff-entered in the same box/flow as BORROWER
 * (2026-07-25 revised user decision) - only the SIGNER'S IDENTITY (the `CoBorrower` profile linked
 * to this loan's borrower, used for the audit trail's name and the `coBorrowerId` FK) is required
 * to already exist; the phone number itself is never read from that profile, so staff can send to
 * an updated/different number without first editing the CoBorrower record.
 */
export class CreateLoanSigningSessionUseCase {
  constructor(private readonly deps: CreateLoanSigningSessionUseCaseDeps) {}

  async execute(
    loanAccountId: string,
    phoneNumber: string,
    createdByUserId: string,
    createdByIp: string | undefined,
    partyType: SigningPartyType = 'BORROWER',
  ): Promise<{ session: LoanSigningSession; rawToken: string }> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', loanAccountId);

    let coBorrowerId: string | undefined;
    const recipientPhoneNumber = phoneNumber;
    if (partyType === 'CO_BORROWER') {
      const coBorrowers = await this.deps.coBorrowerRepository.findByBorrowerId(loanAccount.borrowerId);
      const coBorrower = coBorrowers[0];
      if (!coBorrower) throw new NoCoBorrowerLinkedError();
      coBorrowerId = coBorrower.id;
    }

    const requiredTemplates = await this.deps.documentTemplateRepository.findRequired();
    if (requiredTemplates.length === 0) throw new NoRequiredDocumentTemplatesError();

    const loanProductVersion = await this.deps.loanProductRepository.findVersionById(loanAccount.loanProductVersionId);
    const conditionalTemplates = loanProductVersion
      ? await this.deps.documentTemplateRepository.findConditionalForLoanProduct(loanProductVersion.loanProductId)
      : [];

    const applicableTemplates = [...requiredTemplates, ...conditionalTemplates]
      .filter((t) => (partyType === 'CO_BORROWER' ? t.requiresCoBorrowerSignature : t.requiresBorrowerSignature))
      .sort((a, b) => a.sortIndex - b.sortIndex);
    if (applicableTemplates.length === 0) throw new NoDocumentsForPartyError(partyType);

    const latestPerTemplate = await this.deps.generatedLoanDocumentRepository.findLatestPerTemplateForLoanAccount(loanAccountId);
    const latestByTemplateId = new Map(latestPerTemplate.map((d) => [d.documentTemplateId, d]));

    const documents: { generatedLoanDocumentId: string; sortIndex: number }[] = [];
    for (const template of applicableTemplates) {
      const existing = latestByTemplateId.get(template.id);
      const generatedLoanDocumentId = existing
        ? existing.id
        : (await this.deps.generateLoanDocumentUseCase.execute(loanAccountId, template.code, createdByUserId)).id;
      documents.push({ generatedLoanDocumentId, sortIndex: template.sortIndex });
    }

    const rawToken = generateSigningToken();
    const tokenHash = hashSigningSecret(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

    const session = LoanSigningSession.create({
      loanAccountId,
      partyType,
      coBorrowerId,
      phoneNumber: recipientPhoneNumber,
      tokenHash,
      expiresAt,
      createdByUserId,
      createdByIp,
      documents,
    });
    await this.deps.loanSigningSessionRepository.create(session);

    const signingUrl = `${env.CORS_ORIGIN}/sign/${rawToken}`;
    const partyLabel = partyType === 'CO_BORROWER' ? ' (co-borrower)' : '';
    await this.deps.smsGateway.send(
      recipientPhoneNumber,
      `Easycash: Please review and sign your loan document(s)${partyLabel} (${documents.length} in total) here: ${signingUrl} - link expires in ${SESSION_TTL_DAYS} days.`,
    );

    return { session, rawToken };
  }
}

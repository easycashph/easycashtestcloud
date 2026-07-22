import { NotFoundError } from '@shared/errors/DomainError';
import { env } from '@shared/config/env';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { IDocumentTemplateRepository } from '@modules/loan-document/application/ports/IDocumentTemplateRepository';
import type { IGeneratedLoanDocumentRepository } from '@modules/loan-document/application/ports/IGeneratedLoanDocumentRepository';
import type { GenerateLoanDocumentUseCase } from '@modules/loan-document/application/use-cases/GenerateLoanDocumentUseCase';
import type { ISmsGateway } from '@modules/sms-reminder/application/ports/ISmsGateway';
import { LoanSigningSession } from '../../domain/LoanSigningSession';
import { NoRequiredDocumentTemplatesError } from '../../domain/errors/LoanSigningDomainErrors';
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
  smsGateway: ISmsGateway;
}

/**
 * 2026-07-22 (e-signature). Batches every REQUIRED `DocumentTemplate` plus whichever CONDITIONAL
 * templates are mapped to this loan account's specific product (via `DocumentTemplateMapping` -
 * confirmed 2026-07-22 to already be populated for Seafarer Loan: Loan Agreement, Deed of
 * Assignment (Borrower + Co-Borrower), Special Power of Attorney; and for Salary Loan products)
 * into one signing session. Generates any document that doesn't already have a
 * `GeneratedLoanDocument` on file yet (reuses the same `GenerateLoanDocumentUseCase` the Documents
 * tab's "Generate" button calls), then sends a single SMS with the signing link - one link, one
 * OTP verification, every document signed in the same client visit.
 */
export class CreateLoanSigningSessionUseCase {
  constructor(private readonly deps: CreateLoanSigningSessionUseCaseDeps) {}

  async execute(
    loanAccountId: string,
    phoneNumber: string,
    createdByUserId: string,
    createdByIp: string | undefined,
  ): Promise<{ session: LoanSigningSession; rawToken: string }> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', loanAccountId);

    const requiredTemplates = await this.deps.documentTemplateRepository.findRequired();
    if (requiredTemplates.length === 0) throw new NoRequiredDocumentTemplatesError();

    const loanProductVersion = await this.deps.loanProductRepository.findVersionById(loanAccount.loanProductVersionId);
    const conditionalTemplates = loanProductVersion
      ? await this.deps.documentTemplateRepository.findConditionalForLoanProduct(loanProductVersion.loanProductId)
      : [];

    const applicableTemplates = [...requiredTemplates, ...conditionalTemplates].sort((a, b) => a.sortIndex - b.sortIndex);

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
      phoneNumber,
      tokenHash,
      expiresAt,
      createdByUserId,
      createdByIp,
      documents,
    });
    await this.deps.loanSigningSessionRepository.create(session);

    const signingUrl = `${env.CORS_ORIGIN}/sign/${rawToken}`;
    await this.deps.smsGateway.send(
      phoneNumber,
      `Easycash: Please review and sign your loan document(s) (${documents.length} in total) here: ${signingUrl} - link expires in ${SESSION_TTL_DAYS} days.`,
    );

    return { session, rawToken };
  }
}

import { randomUUID } from 'node:crypto';
import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { LoanAccountStatus } from '@modules/loan-account/domain/LoanAccount';
import type { ILoanProductRepository } from '@modules/loan-product/application/ports/ILoanProductRepository';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import { GeneratedLoanDocument } from '../../domain/GeneratedLoanDocument';
import { DocumentTemplateNotApplicableError, LoanNotYetApprovedError } from '../../domain/errors/LoanDocumentDomainErrors';
import type { IDocumentTemplateRepository } from '../ports/IDocumentTemplateRepository';
import type { IGeneratedLoanDocumentRepository } from '../ports/IGeneratedLoanDocumentRepository';
import type { ILoanDocumentMergeDataResolver } from '../ports/ILoanDocumentMergeDataResolver';
import type { IDocumentFiller } from '../ports/IDocumentFiller';
import type { IDocxToPdfConverter } from '../ports/IDocxToPdfConverter';

/** ADR-051 §2: terms must be final (APPROVED) before documents can be generated; still allowed after activation. */
const GENERATABLE_STATUSES: LoanAccountStatus[] = ['APPROVED', 'ACTIVE', 'ACTIVE_IN_ARREARS'];

export interface GenerateLoanDocumentUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  loanProductRepository: ILoanProductRepository;
  documentTemplateRepository: IDocumentTemplateRepository;
  generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
  mergeDataResolver: ILoanDocumentMergeDataResolver;
  documentFiller: IDocumentFiller;
  docxToPdfConverter: IDocxToPdfConverter;
  fileStorage: IFileStorage;
}

export class GenerateLoanDocumentUseCase {
  constructor(private readonly deps: GenerateLoanDocumentUseCaseDeps) {}

  async execute(loanAccountId: string, documentTemplateCode: string, generatedByUserId: string): Promise<GeneratedLoanDocument> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', loanAccountId);
    if (!GENERATABLE_STATUSES.includes(loanAccount.status)) {
      throw new LoanNotYetApprovedError(loanAccount.status);
    }

    const template = await this.deps.documentTemplateRepository.findByCode(documentTemplateCode);
    if (!template) throw new NotFoundError('DocumentTemplate', documentTemplateCode);

    if (!template.isRequired) {
      const loanProductVersion = await this.deps.loanProductRepository.findVersionById(loanAccount.loanProductVersionId);
      if (!loanProductVersion) throw new NotFoundError('LoanProductVersion', loanAccount.loanProductVersionId);

      const applicableConditional = await this.deps.documentTemplateRepository.findConditionalForLoanProduct(
        loanProductVersion.loanProductId,
      );
      if (!applicableConditional.some((t) => t.id === template.id)) {
        throw new DocumentTemplateNotApplicableError(template.code);
      }
    }

    const mergeData = await this.deps.mergeDataResolver.resolve(loanAccountId);
    const filledDocx = await this.deps.documentFiller.fill(template.code, mergeData);
    const pdfBuffer = await this.deps.docxToPdfConverter.convert(filledDocx);

    const storageKey = `loan-documents/${loanAccountId}/${template.code}-${randomUUID()}.pdf`;
    await this.deps.fileStorage.save(storageKey, pdfBuffer);

    const generatedDocument = GeneratedLoanDocument.create({
      loanAccountId,
      documentTemplateId: template.id,
      storageKey,
      generatedByUserId,
    });
    await this.deps.generatedLoanDocumentRepository.create(generatedDocument);

    return generatedDocument;
  }
}

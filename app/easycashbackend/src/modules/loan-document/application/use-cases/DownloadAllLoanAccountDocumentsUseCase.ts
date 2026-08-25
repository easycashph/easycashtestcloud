import { NotFoundError } from '@shared/errors/DomainError';
import type { ILoanAccountRepository } from '@modules/loan-account/application/ports/ILoanAccountRepository';
import type { IAttachmentRepository } from '@modules/document/application/ports/IAttachmentRepository';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import { documentCategoryLabel } from '@modules/document/application/documentCategoryLabel';
import { resolveAttachmentFileName } from '@modules/document/application/resolveAttachmentFileName';
import type { ILoanSigningSessionRepository } from '@modules/loan-signing/application/ports/ILoanSigningSessionRepository';
import { buildUniqueZipEntryPath } from '@shared/application/buildUniqueZipEntryPath';
import type { IGeneratedLoanDocumentRepository } from '../ports/IGeneratedLoanDocumentRepository';
import type { IDocumentTemplateRepository } from '../ports/IDocumentTemplateRepository';

export interface ZipEntry {
  path: string;
  data: Buffer;
}

export interface DownloadAllLoanAccountDocumentsUseCaseDeps {
  loanAccountRepository: ILoanAccountRepository;
  attachmentRepository: IAttachmentRepository;
  generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
  documentTemplateRepository: IDocumentTemplateRepository;
  loanSigningSessionRepository: ILoanSigningSessionRepository;
  attachmentFileStorage: IFileStorage;
  loanDocumentFileStorage: IFileStorage;
}

/** MIS-only bulk export (2026-08-20 user request): everything tied to one loan account - manually
 * uploaded attachments, the currently-generated set of loan documents (same "latest per template"
 * set the Documents tab shows, not every historical regeneration), and every signed PDF from
 * completed e-signature sessions - packaged into one organized ZIP, so MIS doesn't have to download
 * each file one at a time. */
export class DownloadAllLoanAccountDocumentsUseCase {
  constructor(private readonly deps: DownloadAllLoanAccountDocumentsUseCaseDeps) {}

  async execute(loanAccountId: string): Promise<{ zipFileName: string; entries: ZipEntry[] }> {
    const loanAccount = await this.deps.loanAccountRepository.findById(loanAccountId);
    if (!loanAccount) throw new NotFoundError('LoanAccount', loanAccountId);

    const usedPaths = new Set<string>();
    const entries: ZipEntry[] = [];

    // Some legacy-migrated attachment/document rows carry a placeholder `storageKey` (e.g.
    // `legacy-unmigrated:...`) with no real file behind it - the original SDevTech file was never
    // carried over. Skip an unreadable entry rather than fail the whole ZIP over one missing file;
    // the other real documents still deserve to reach MIS. Same underlying gap every single-file
    // download endpoint has always had for these rows.
    const attachments = await this.deps.attachmentRepository.listByOwner('LOAN_ACCOUNT', loanAccountId);
    for (const attachment of attachments) {
      try {
        const data = await this.deps.attachmentFileStorage.read(attachment.storageKey);
        const path = buildUniqueZipEntryPath(
          usedPaths,
          `Uploaded Attachments/${documentCategoryLabel(attachment.documentCategory)}`,
          resolveAttachmentFileName(attachment.fileName, attachment.fileType),
        );
        entries.push({ path, data });
      } catch (error) {
        console.error(`[DownloadAllLoanAccountDocumentsUseCase] skipping unreadable attachment ${attachment.id}`, error);
      }
    }

    const generatedDocuments = await this.deps.generatedLoanDocumentRepository.findLatestPerTemplateForLoanAccount(loanAccountId);
    for (const doc of generatedDocuments) {
      try {
        const full = await this.deps.generatedLoanDocumentRepository.findById(doc.id);
        if (!full) continue;
        const data = await this.deps.loanDocumentFileStorage.read(full.storageKey);
        const path = buildUniqueZipEntryPath(usedPaths, 'Generated Documents', `${doc.documentTemplateName}.pdf`);
        entries.push({ path, data });
      } catch (error) {
        console.error(`[DownloadAllLoanAccountDocumentsUseCase] skipping unreadable generated document ${doc.id}`, error);
      }
    }

    const signingSessions = await this.deps.loanSigningSessionRepository.findManyByLoanAccountId(loanAccountId);
    for (const session of signingSessions) {
      const partyLabel = session.partyType === 'CO_BORROWER' ? 'Co-Borrower' : 'Borrower';
      for (const document of session.documents) {
        if (!document.signedStorageKey) continue;
        try {
          const generated = await this.deps.generatedLoanDocumentRepository.findById(document.generatedLoanDocumentId);
          const template = generated ? await this.deps.documentTemplateRepository.findById(generated.documentTemplateId) : null;
          const label = template?.name ?? 'Signed Document';
          const data = await this.deps.loanDocumentFileStorage.read(document.signedStorageKey);
          const path = buildUniqueZipEntryPath(usedPaths, 'Signed Documents', `${label} - ${partyLabel} (Signed).pdf`);
          entries.push({ path, data });
        } catch (error) {
          console.error(`[DownloadAllLoanAccountDocumentsUseCase] skipping unreadable signed document ${document.id}`, error);
        }
      }
    }

    const datedSuffix = new Date().toISOString().slice(0, 10);
    const zipFileName = `${loanAccount.loanCode}-Documents-${datedSuffix}.zip`.replace(/\s+/g, '_');
    return { zipFileName, entries };
  }
}

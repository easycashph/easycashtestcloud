import { NotFoundError } from '@shared/errors/DomainError';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { IGeneratedLoanDocumentRepository } from '../ports/IGeneratedLoanDocumentRepository';
import type { IDocumentTemplateRepository } from '../ports/IDocumentTemplateRepository';

export interface GetGeneratedLoanDocumentFileUseCaseDeps {
  generatedLoanDocumentRepository: IGeneratedLoanDocumentRepository;
  documentTemplateRepository: IDocumentTemplateRepository;
  fileStorage: IFileStorage;
}

export interface GeneratedLoanDocumentFile {
  loanAccountId: string;
  fileName: string;
  buffer: Buffer;
}

export class GetGeneratedLoanDocumentFileUseCase {
  constructor(private readonly deps: GetGeneratedLoanDocumentFileUseCaseDeps) {}

  async execute(generatedLoanDocumentId: string): Promise<GeneratedLoanDocumentFile> {
    const document = await this.deps.generatedLoanDocumentRepository.findById(generatedLoanDocumentId);
    if (!document) throw new NotFoundError('GeneratedLoanDocument', generatedLoanDocumentId);

    const [buffer, template] = await Promise.all([
      this.deps.fileStorage.read(document.storageKey),
      this.deps.documentTemplateRepository.findById(document.documentTemplateId),
    ]);
    const dateStamp = document.generatedAt.toISOString().slice(0, 10);
    const fileName = `${template?.name ?? 'Document'} - ${dateStamp}.pdf`;

    return { loanAccountId: document.loanAccountId, fileName, buffer };
  }
}

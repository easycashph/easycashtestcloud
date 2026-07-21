import { NotFoundError } from '@shared/errors/DomainError';
import type { IFileStorage } from '@shared/application/ports/IFileStorage';
import type { IGeneratedStatementOfAccountRepository } from '../ports/IGeneratedStatementOfAccountRepository';

export interface GetGeneratedStatementOfAccountFileUseCaseDeps {
  generatedStatementOfAccountRepository: IGeneratedStatementOfAccountRepository;
  fileStorage: IFileStorage;
}

export interface GeneratedStatementOfAccountFile {
  loanAccountId: string;
  fileName: string;
  buffer: Buffer;
}

export class GetGeneratedStatementOfAccountFileUseCase {
  constructor(private readonly deps: GetGeneratedStatementOfAccountFileUseCaseDeps) {}

  async execute(generatedStatementOfAccountId: string): Promise<GeneratedStatementOfAccountFile> {
    const statement = await this.deps.generatedStatementOfAccountRepository.findById(generatedStatementOfAccountId);
    if (!statement) throw new NotFoundError('GeneratedStatementOfAccount', generatedStatementOfAccountId);

    const buffer = await this.deps.fileStorage.read(statement.storageKey);
    const dateStamp = statement.generatedAt.toISOString().slice(0, 10);
    const fileName = `Statement of Account - ${dateStamp}.pdf`;

    return { loanAccountId: statement.loanAccountId, fileName, buffer };
  }
}

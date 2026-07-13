import { NotFoundError } from '@shared/errors/DomainError';
import type { AttachmentRecord, IAttachmentRepository } from '../ports/IAttachmentRepository';
import type { IFileStorage } from '../ports/IFileStorage';

export class DownloadAttachmentUseCase {
  constructor(
    private readonly deps: {
      attachmentRepository: IAttachmentRepository;
      fileStorage: IFileStorage;
    },
  ) {}

  async execute(id: string): Promise<{ record: AttachmentRecord; data: Buffer }> {
    const record = await this.deps.attachmentRepository.findById(id);
    if (!record) throw new NotFoundError('Attachment', id);
    const data = await this.deps.fileStorage.read(record.storageKey);
    return { record, data };
  }
}

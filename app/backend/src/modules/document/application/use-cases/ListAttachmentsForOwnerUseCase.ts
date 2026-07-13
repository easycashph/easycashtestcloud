import type { AttachmentOwnerType, AttachmentRecord, IAttachmentRepository } from '../ports/IAttachmentRepository';

export class ListAttachmentsForOwnerUseCase {
  constructor(private readonly deps: { attachmentRepository: IAttachmentRepository }) {}

  async execute(ownerType: AttachmentOwnerType, ownerId: string): Promise<AttachmentRecord[]> {
    return this.deps.attachmentRepository.listByOwner(ownerType, ownerId);
  }
}

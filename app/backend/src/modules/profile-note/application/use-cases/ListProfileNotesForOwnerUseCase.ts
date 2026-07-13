import type { IProfileNoteRepository, ProfileNoteOwnerType, ProfileNoteRecord } from '../ports/IProfileNoteRepository';

export class ListProfileNotesForOwnerUseCase {
  constructor(private readonly deps: { profileNoteRepository: IProfileNoteRepository }) {}

  async execute(ownerType: ProfileNoteOwnerType, ownerId: string): Promise<ProfileNoteRecord[]> {
    return this.deps.profileNoteRepository.listByOwner(ownerType, ownerId);
  }
}

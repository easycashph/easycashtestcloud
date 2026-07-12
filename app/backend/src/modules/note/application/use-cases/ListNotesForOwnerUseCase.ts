import type { INoteRepository, NoteOwnerType, NoteRecord } from '../ports/INoteRepository';

export class ListNotesForOwnerUseCase {
  constructor(private readonly deps: { noteRepository: INoteRepository }) {}

  async execute(ownerType: NoteOwnerType, ownerId: string): Promise<NoteRecord[]> {
    return this.deps.noteRepository.listByOwner(ownerType, ownerId);
  }
}

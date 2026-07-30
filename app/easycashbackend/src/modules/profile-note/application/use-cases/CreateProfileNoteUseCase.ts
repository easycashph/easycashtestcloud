import { ValidationError } from '@shared/errors/DomainError';
import type { CreateProfileNoteInput, IProfileNoteRepository, ProfileNoteRecord } from '../ports/IProfileNoteRepository';

export class CreateProfileNoteUseCase {
  constructor(private readonly deps: { profileNoteRepository: IProfileNoteRepository }) {}

  async execute(input: CreateProfileNoteInput): Promise<ProfileNoteRecord> {
    if (!input.text.trim()) {
      throw new ValidationError('Note text must not be blank.');
    }
    return this.deps.profileNoteRepository.create({ ...input, text: input.text.trim() });
  }
}

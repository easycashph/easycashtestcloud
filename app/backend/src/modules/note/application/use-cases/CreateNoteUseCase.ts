import { ValidationError } from '@shared/errors/DomainError';
import type { CreateNoteInput, INoteRepository, NoteRecord } from '../ports/INoteRepository';

export class CreateNoteUseCase {
  constructor(private readonly deps: { noteRepository: INoteRepository }) {}

  async execute(input: CreateNoteInput): Promise<NoteRecord> {
    if (!input.text.trim()) {
      throw new ValidationError('Note text must not be blank.');
    }
    return this.deps.noteRepository.create({ ...input, text: input.text.trim() });
  }
}

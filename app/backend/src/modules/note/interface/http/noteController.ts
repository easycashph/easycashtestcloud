import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { CreateNoteUseCase } from '../../application/use-cases/CreateNoteUseCase';
import type { ListNotesForOwnerUseCase } from '../../application/use-cases/ListNotesForOwnerUseCase';
import { createNoteSchema, noteOwnerTypeSchema } from './noteSchemas';
import { presentNote } from './presenters/NotePresenter';

export interface NoteControllerDeps {
  createNoteUseCase: CreateNoteUseCase;
  listNotesForOwnerUseCase: ListNotesForOwnerUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class NoteController {
  constructor(private readonly deps: NoteControllerDeps) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createNoteSchema.parse(req.body);
      const currentUser = getCurrentUser(req);
      const note = await this.deps.createNoteUseCase.execute({ ...body, authorUserId: currentUser.sub });
      res.status(201).json(presentNote(note));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerType = noteOwnerTypeSchema.parse(req.query.ownerType);
      const ownerId = String(req.query.ownerId ?? '');
      if (!ownerId) throw new ValidationError('ownerId query parameter is required.');
      const notes = await this.deps.listNotesForOwnerUseCase.execute(ownerType, ownerId);
      res.status(200).json(notes.map(presentNote));
    } catch (error) {
      next(error);
    }
  };
}

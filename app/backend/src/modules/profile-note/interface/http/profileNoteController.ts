import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '@shared/errors/DomainError';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { CreateProfileNoteUseCase } from '../../application/use-cases/CreateProfileNoteUseCase';
import type { ListProfileNotesForOwnerUseCase } from '../../application/use-cases/ListProfileNotesForOwnerUseCase';
import { createProfileNoteSchema, profileNoteOwnerTypeSchema } from './profileNoteSchemas';
import { presentProfileNote } from './presenters/ProfileNotePresenter';

export interface ProfileNoteControllerDeps {
  createProfileNoteUseCase: CreateProfileNoteUseCase;
  listProfileNotesForOwnerUseCase: ListProfileNotesForOwnerUseCase;
}

/** Thin controller only — no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class ProfileNoteController {
  constructor(private readonly deps: ProfileNoteControllerDeps) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = createProfileNoteSchema.parse(req.body);
      const currentUser = getCurrentUser(req);
      const note = await this.deps.createProfileNoteUseCase.execute({ ...body, authorUserId: currentUser.sub });
      res.status(201).json(presentProfileNote(note));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const ownerType = profileNoteOwnerTypeSchema.parse(req.query.ownerType);
      const ownerId = String(req.query.ownerId ?? '');
      if (!ownerId) throw new ValidationError('ownerId query parameter is required.');
      const notes = await this.deps.listProfileNotesForOwnerUseCase.execute(ownerType, ownerId);
      res.status(200).json(notes.map(presentProfileNote));
    } catch (error) {
      next(error);
    }
  };
}

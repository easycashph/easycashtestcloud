import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { NoteController, type NoteControllerDeps } from './noteController';

export function createNoteRouter(deps: NoteControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new NoteController(deps);
  const requireAuth = createRequireAuth(tokenService);

  // No role restriction on write, unlike Attachments (ADR-014's ATTACHMENT_WRITE_ROLES) - notes
  // are a low-stakes running log ("borrower confirmed employment over the phone"), and the mock
  // NotesPanel this replaces was likewise open to any authenticated staff member.
  router.post('/notes', requireAuth, controller.create);
  router.get('/notes', requireAuth, controller.list);

  return router;
}

import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { ProfileNoteController, type ProfileNoteControllerDeps } from './profileNoteController';

/** `/profile-notes` - a simple, undeletable running log shared across Borrower/LoanAccount/
 * LoanApplication profiles (renamed from `/notes` on 2026-07-13). */
export function createProfileNoteRouter(deps: ProfileNoteControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new ProfileNoteController(deps);
  const requireAuth = createRequireAuth(tokenService);

  // No role restriction on write, unlike Attachments (ADR-014's ATTACHMENT_WRITE_ROLES) - notes
  // are a low-stakes running log ("borrower confirmed employment over the phone"), open to any
  // authenticated staff member.
  router.post('/profile-notes', requireAuth, controller.create);
  router.get('/profile-notes', requireAuth, controller.list);

  return router;
}

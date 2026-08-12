import { Router } from 'express';
import type { ITokenService } from '@modules/identity/application/ports/ITokenService';
import { createRequireAuth } from '@shared/middleware/requireAuth';
import { requirePermission } from '@shared/middleware/requirePermission';
import { ProfileNoteController, type ProfileNoteControllerDeps } from './profileNoteController';

/** `/profile-notes` - a simple, undeletable running log shared across Borrower/LoanAccount/
 * LoanApplication profiles (renamed from `/notes` on 2026-07-13). */
export function createProfileNoteRouter(deps: ProfileNoteControllerDeps, tokenService: ITokenService): Router {
  const router = Router();
  const controller = new ProfileNoteController(deps);
  const requireAuth = createRequireAuth(tokenService);

  // 2026-08-06: gated by `collection.note.write` (Roles & Permissions feature) - previously no
  // role restriction on write, unlike Attachments (ADR-014's ATTACHMENT_WRITE_ROLES); notes were
  // treated as a low-stakes running log ("borrower confirmed employment over the phone"). Default
  // grant is every role (preserving that behavior), configurable by MIS from there.
  router.post('/profile-notes', requireAuth, requirePermission('collection.note.write'), controller.create);
  router.get('/profile-notes', requireAuth, controller.list);

  return router;
}

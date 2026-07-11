import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import { resolveBranchScope, assertBranchAccess } from '@shared/http/branchScope';
import type { CreateLoanNoteUseCase } from '../../application/use-cases/CreateLoanNoteUseCase';
import type { ListLoanNotesUseCase } from '../../application/use-cases/ListLoanNotesUseCase';
import type { GetLoanAccountUseCase } from '@modules/loan-account/application/use-cases/GetLoanAccountUseCase';
import type { CreateLoanNoteRequestBody } from './loanNoteSchemas';
import { presentLoanNote, presentLoanNoteView } from './presenters/LoanNotePresenter';

export interface LoanNoteControllerDeps {
  createLoanNoteUseCase: CreateLoanNoteUseCase;
  listLoanNotesUseCase: ListLoanNotesUseCase;
  getLoanAccountUseCase: GetLoanAccountUseCase;
}

/** Thin controllers only — no business logic here (CLAUDE.md §Architecture). */
export class LoanNoteController {
  constructor(private readonly deps: LoanNoteControllerDeps) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const currentUser = getCurrentUser(req);
      const body = req.body as CreateLoanNoteRequestBody;
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: same as every other loan-account sub-resource write.

      const note = await this.deps.createLoanNoteUseCase.execute(req.params.id as string, currentUser.sub, body.text);
      res.status(201).json(presentLoanNote(note));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const scope = resolveBranchScope(req);
      const existing = await this.deps.getLoanAccountUseCase.execute(req.params.id as string);
      assertBranchAccess(scope, existing.branchId); // H-1: same as every other loan-account sub-resource read.

      const notes = await this.deps.listLoanNotesUseCase.execute(req.params.id as string);
      res.status(200).json({ items: notes.map(presentLoanNoteView) });
    } catch (error) {
      next(error);
    }
  };
}

import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { CreateLoanSigningSessionUseCase } from '../../application/use-cases/CreateLoanSigningSessionUseCase';
import type { ListLoanSigningSessionsUseCase } from '../../application/use-cases/ListLoanSigningSessionsUseCase';
import type { GetSignedLoanSigningDocumentFileUseCase } from '../../application/use-cases/GetSignedLoanSigningDocumentFileUseCase';
import type { CreateLoanSigningSessionRequestBody } from './loanSigningSchemas';
import { presentLoanSigningSessionStatus } from './presenters/LoanSigningSessionPresenter';

export interface LoanSigningControllerDeps {
  createLoanSigningSessionUseCase: CreateLoanSigningSessionUseCase;
  listLoanSigningSessionsUseCase: ListLoanSigningSessionsUseCase;
  getSignedLoanSigningDocumentFileUseCase: GetSignedLoanSigningDocumentFileUseCase;
}

/** Staff-side (authenticated) controller - creates and lists signing sessions for one loan
 * account. See `publicLoanSigningController.ts` for the unauthenticated client-facing half. */
export class LoanSigningController {
  constructor(private readonly deps: LoanSigningControllerDeps) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateLoanSigningSessionRequestBody;
      const currentUser = getCurrentUser(req);
      const { session } = await this.deps.createLoanSigningSessionUseCase.execute(
        req.params.loanAccountId as string,
        body.phoneNumber,
        currentUser.sub,
        req.ip,
        body.partyType,
      );
      res.status(201).json(presentLoanSigningSessionStatus(session));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await this.deps.listLoanSigningSessionsUseCase.execute(req.params.loanAccountId as string);
      res.status(200).json({ items });
    } catch (error) {
      next(error);
    }
  };

  getDocumentFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const buffer = await this.deps.getSignedLoanSigningDocumentFileUseCase.execute(
        req.params.loanAccountId as string,
        req.params.sessionId as string,
        req.params.documentId as string,
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.status(200).send(buffer);
    } catch (error) {
      next(error);
    }
  };
}

import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { CreateLoanSigningSessionUseCase } from '../../application/use-cases/CreateLoanSigningSessionUseCase';
import type { ListLoanSigningSessionsUseCase } from '../../application/use-cases/ListLoanSigningSessionsUseCase';
import type { CreateLoanSigningSessionRequestBody } from './loanSigningSchemas';
import { presentLoanSigningSessionStatus } from './presenters/LoanSigningSessionPresenter';

export interface LoanSigningControllerDeps {
  createLoanSigningSessionUseCase: CreateLoanSigningSessionUseCase;
  listLoanSigningSessionsUseCase: ListLoanSigningSessionsUseCase;
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
      );
      res.status(201).json(presentLoanSigningSessionStatus(session));
    } catch (error) {
      next(error);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessions = await this.deps.listLoanSigningSessionsUseCase.execute(req.params.loanAccountId as string);
      res.status(200).json({ items: sessions.map(presentLoanSigningSessionStatus) });
    } catch (error) {
      next(error);
    }
  };
}

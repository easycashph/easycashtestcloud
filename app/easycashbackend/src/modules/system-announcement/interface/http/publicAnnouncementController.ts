import type { NextFunction, Request, Response } from 'express';
import type { GetActiveSystemAnnouncementUseCase } from '../../application/use-cases/GetActiveSystemAnnouncementUseCase';
import { presentSystemAnnouncement } from './presenters/SystemAnnouncementPresenter';

export interface PublicAnnouncementControllerDeps {
  getActiveSystemAnnouncementUseCase: GetActiveSystemAnnouncementUseCase;
}

export class PublicAnnouncementController {
  constructor(private readonly deps: PublicAnnouncementControllerDeps) {}

  getActiveForPortal = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const announcement = await this.deps.getActiveSystemAnnouncementUseCase.execute('PORTAL');
      res.status(200).json(announcement ? presentSystemAnnouncement(announcement) : null);
    } catch (error) {
      next(error);
    }
  };
}

import type { NextFunction, Request, Response } from 'express';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { CreateSystemAnnouncementUseCase } from '../../application/use-cases/CreateSystemAnnouncementUseCase';
import type { ListSystemAnnouncementsUseCase } from '../../application/use-cases/ListSystemAnnouncementsUseCase';
import type { UpdateSystemAnnouncementUseCase } from '../../application/use-cases/UpdateSystemAnnouncementUseCase';
import type { DeleteSystemAnnouncementUseCase } from '../../application/use-cases/DeleteSystemAnnouncementUseCase';
import type { GetActiveSystemAnnouncementUseCase } from '../../application/use-cases/GetActiveSystemAnnouncementUseCase';
import { presentSystemAnnouncement } from './presenters/SystemAnnouncementPresenter';
import type { CreateSystemAnnouncementRequestBody, UpdateSystemAnnouncementRequestBody } from './systemAnnouncementSchemas';

export interface SystemAnnouncementControllerDeps {
  createSystemAnnouncementUseCase: CreateSystemAnnouncementUseCase;
  listSystemAnnouncementsUseCase: ListSystemAnnouncementsUseCase;
  updateSystemAnnouncementUseCase: UpdateSystemAnnouncementUseCase;
  deleteSystemAnnouncementUseCase: DeleteSystemAnnouncementUseCase;
  getActiveSystemAnnouncementUseCase: GetActiveSystemAnnouncementUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture). `create`/`list`/
 * `update`/`delete` are MIS-only (router's `system_announcement.manage` gate); `getActiveForLms`
 * is any authenticated staff user (every LMS user needs to see the popup, not just MIS). */
export class SystemAnnouncementController {
  constructor(private readonly deps: SystemAnnouncementControllerDeps) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = getCurrentUser(req);
      const body = req.body as CreateSystemAnnouncementRequestBody;
      const announcement = await this.deps.createSystemAnnouncementUseCase.execute({
        title: body.title,
        body: body.body,
        type: body.type,
        showOnLms: body.showOnLms,
        showOnPortal: body.showOnPortal,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdByUserId: currentUser.sub,
      });
      res.status(201).json(presentSystemAnnouncement(announcement));
    } catch (error) {
      next(error);
    }
  };

  list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const announcements = await this.deps.listSystemAnnouncementsUseCase.execute();
      res.status(200).json(announcements.map(presentSystemAnnouncement));
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as UpdateSystemAnnouncementRequestBody;
      const announcement = await this.deps.updateSystemAnnouncementUseCase.execute(req.params.id as string, {
        title: body.title,
        body: body.body,
        type: body.type,
        showOnLms: body.showOnLms,
        showOnPortal: body.showOnPortal,
        active: body.active,
        expiresAt: body.expiresAt === undefined ? undefined : body.expiresAt ? new Date(body.expiresAt) : null,
      });
      res.status(200).json(presentSystemAnnouncement(announcement));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.deps.deleteSystemAnnouncementUseCase.execute(req.params.id as string);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  getActiveForLms = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const announcement = await this.deps.getActiveSystemAnnouncementUseCase.execute('LMS');
      res.status(200).json(announcement ? presentSystemAnnouncement(announcement) : null);
    } catch (error) {
      next(error);
    }
  };
}

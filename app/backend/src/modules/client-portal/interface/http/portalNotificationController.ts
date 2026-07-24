import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, toPaginatedResponse } from '@shared/http/pagination';
import type { ListPortalNotificationsUseCase } from '../../application/use-cases/ListPortalNotificationsUseCase';
import type { MarkPortalNotificationReadUseCase } from '../../application/use-cases/MarkPortalNotificationReadUseCase';
import type { MarkAllPortalNotificationsReadUseCase } from '../../application/use-cases/MarkAllPortalNotificationsReadUseCase';
import { getCurrentPortalAccount } from './requirePortalAuth';
import { presentPortalNotification } from './presenters/PortalNotificationPresenter';

export interface PortalNotificationControllerDeps {
  listPortalNotificationsUseCase: ListPortalNotificationsUseCase;
  markPortalNotificationReadUseCase: MarkPortalNotificationReadUseCase;
  markAllPortalNotificationsReadUseCase: MarkAllPortalNotificationsReadUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture), mirrors notificationController. */
export class PortalNotificationController {
  constructor(private readonly deps: PortalNotificationControllerDeps) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      const { limit, cursor } = parsePaginationParams(req.query);
      const unreadOnly = req.query.unreadOnly === 'true';
      const { items, unreadCount } = await this.deps.listPortalNotificationsUseCase.execute({
        portalAccountId: account.sub,
        limit,
        cursor,
        unreadOnly,
      });
      res.status(200).json({ ...toPaginatedResponse(items.map(presentPortalNotification), limit, (item) => item.id), unreadCount });
    } catch (error) {
      next(error);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      await this.deps.markPortalNotificationReadUseCase.execute(req.params.id as string, account.sub);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  markAllRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const account = getCurrentPortalAccount(req);
      await this.deps.markAllPortalNotificationsReadUseCase.execute(account.sub);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

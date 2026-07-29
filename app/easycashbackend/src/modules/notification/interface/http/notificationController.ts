import type { NextFunction, Request, Response } from 'express';
import { parsePaginationParams, toPaginatedResponse } from '@shared/http/pagination';
import { getCurrentUser } from '@shared/middleware/requireAuth';
import type { ListNotificationsUseCase } from '../../application/use-cases/ListNotificationsUseCase';
import type { MarkNotificationReadUseCase } from '../../application/use-cases/MarkNotificationReadUseCase';
import type { MarkAllNotificationsReadUseCase } from '../../application/use-cases/MarkAllNotificationsReadUseCase';
import { presentNotification } from './presenters/NotificationPresenter';

export interface NotificationControllerDeps {
  listNotificationsUseCase: ListNotificationsUseCase;
  markNotificationReadUseCase: MarkNotificationReadUseCase;
  markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture), matching every other module's controller shape. */
export class NotificationController {
  constructor(private readonly deps: NotificationControllerDeps) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getCurrentUser(req);
      const { limit, cursor } = parsePaginationParams(req.query);
      const unreadOnly = req.query.unreadOnly === 'true';
      const { items, unreadCount } = await this.deps.listNotificationsUseCase.execute({
        recipientUserId: user.sub,
        limit,
        cursor,
        unreadOnly,
      });
      res.status(200).json({ ...toPaginatedResponse(items.map(presentNotification), limit, (item) => item.id), unreadCount });
    } catch (error) {
      next(error);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getCurrentUser(req);
      await this.deps.markNotificationReadUseCase.execute(req.params.id as string, user.sub);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  markAllRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = getCurrentUser(req);
      await this.deps.markAllNotificationsReadUseCase.execute(user.sub);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}

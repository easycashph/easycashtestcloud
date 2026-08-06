import type { NextFunction, Request, Response } from 'express';
import type { ListExternalNewsLinksUseCase } from '../../application/use-cases/ListExternalNewsLinksUseCase';
import type { ExternalNewsCategory } from '../../application/ports/IExternalNewsLinkRepository';

const VALID_CATEGORIES: ExternalNewsCategory[] = ['FINANCE', 'ADVISORY'];
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export interface ExternalNewsLinkControllerDeps {
  listExternalNewsLinksUseCase: ListExternalNewsLinksUseCase;
}

/** Thin controller only - no business logic here (CLAUDE.md §Architecture). Public,
 * unauthenticated endpoint (see router's own doc comment). */
export class ExternalNewsLinkController {
  constructor(private readonly deps: ExternalNewsLinkControllerDeps) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawCategory = req.query.category;
      const category = VALID_CATEGORIES.includes(rawCategory as ExternalNewsCategory) ? (rawCategory as ExternalNewsCategory) : undefined;
      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT;

      const items = await this.deps.listExternalNewsLinksUseCase.execute(category, limit);
      res.status(200).json(
        items.map((item) => ({
          id: item.id,
          category: item.category,
          title: item.title,
          sourceName: item.sourceName,
          sourceUrl: item.sourceUrl,
          excerpt: item.excerpt,
          publishedAt: item.publishedAt.toISOString(),
        })),
      );
    } catch (error) {
      next(error);
    }
  };
}

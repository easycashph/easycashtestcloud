import type { ExternalNewsCategory, ExternalNewsLinkRecord, IExternalNewsLinkRepository } from '../ports/IExternalNewsLinkRepository';

export interface ListExternalNewsLinksUseCaseDeps {
  externalNewsLinkRepository: IExternalNewsLinkRepository;
}

/** Backs both the homepage "News Flash" ticker (small `limit`, any category) and the public News
 * page's full list (larger `limit`, optionally filtered to one category). Public, unauthenticated -
 * same posture as `portalPsgcRouter.ts` (reference/informational data, not account-specific). */
export class ListExternalNewsLinksUseCase {
  constructor(private readonly deps: ListExternalNewsLinksUseCaseDeps) {}

  async execute(category: ExternalNewsCategory | undefined, limit: number): Promise<ExternalNewsLinkRecord[]> {
    return this.deps.externalNewsLinkRepository.findMany({ category, limit });
  }
}

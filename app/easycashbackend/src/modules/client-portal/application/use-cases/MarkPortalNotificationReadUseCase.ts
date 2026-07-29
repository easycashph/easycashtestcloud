import type { IPortalNotificationRepository } from '../ports/IPortalNotificationRepository';
import { PortalLoanApplicationNotFoundError } from '../../domain/errors/PortalAuthErrors';

/** Mirrors the staff-facing MarkNotificationReadUseCase exactly, scoped to a portal account.
 * Reuses PortalLoanApplicationNotFoundError for the ownership-mismatch case (same enumeration-
 * avoidance reasoning as that error's own doc comment - a caller can't tell "doesn't exist" from
 * "belongs to someone else"), despite the name; it's a generic "not yours" 404 shape, not
 * loan-application-specific. */
export class MarkPortalNotificationReadUseCase {
  constructor(private readonly deps: { portalNotificationRepository: IPortalNotificationRepository }) {}

  async execute(id: string, portalAccountId: string): Promise<void> {
    const notification = await this.deps.portalNotificationRepository.findById(id);
    if (!notification || notification.portalAccountId !== portalAccountId) {
      throw new PortalLoanApplicationNotFoundError();
    }
    await this.deps.portalNotificationRepository.markRead(id);
  }
}

/**
 * Delete Profile Activity Use Case
 *
 * Soft-deletes a profile activity record (sets deletedByMisAt).
 * Only accessible to MIS users (authorization enforced upstream).
 */

import type { IProfileActivityLogRepository } from '../ports/IProfileActivityLogRepository';

export interface DeleteProfileActivityInput {
  activityId: string;
  requestedByUserId: string; // For audit trail (who requested the delete)
}

export class DeleteProfileActivityUseCase {
  constructor(private readonly repository: IProfileActivityLogRepository) {}

  async execute(input: DeleteProfileActivityInput): Promise<void> {
    const activity = await this.repository.findById(input.activityId);

    if (!activity) {
      throw new Error(`Activity not found: ${input.activityId}`);
    }

    if (activity.isDeleted()) {
      throw new Error(`Activity already deleted: ${input.activityId}`);
    }

    await this.repository.softDeleteById(input.activityId);

    // Note: We could log this deletion to AuditLog for compliance,
    // but that's a future enhancement. For now, the soft-delete
    // timestamp itself serves as evidence.
  }
}

import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';

export interface LogSectionViewInput {
  userId: string;
  section: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Records a "viewed this section" audit entry — the read-side counterpart
 * to the write actions already logged by other modules via IAuditLogger.
 * Client-triggered (called once per page mount from the frontend), so it
 * intentionally has no business rule beyond forwarding to the logger.
 */
export class LogSectionViewUseCase {
  constructor(private readonly deps: { auditLogger: IAuditLogger }) {}

  async execute(input: LogSectionViewInput): Promise<void> {
    await this.deps.auditLogger.log({
      userId: input.userId,
      action: 'VIEW_SECTION',
      entityType: input.section,
      entityId: input.entityId ?? input.section,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }
}

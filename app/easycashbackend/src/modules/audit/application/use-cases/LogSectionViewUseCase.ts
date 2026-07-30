import type { IAuditLogger } from '@modules/identity/application/ports/IAuditLogger';

export interface LogSectionViewInput {
  userId: string;
  section: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  /** 2026-07-30 (user request): specific in-section interactions (filtering, opening a specific
   * record) read as generic "viewed this section" noise when every entry uses the same action -
   * lets a caller log a more precise action name (e.g. "FILTER_SECTION", "OPEN_SIGNING_LOG") while
   * staying under the same section/entityType scoping. Defaults to the original "VIEW_SECTION" so
   * every existing `useLogPageView` call site (page-mount logging, unchanged) keeps working as-is. */
  action?: string;
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
      action: input.action ?? 'VIEW_SECTION',
      entityType: input.section,
      entityId: input.entityId ?? input.section,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }
}

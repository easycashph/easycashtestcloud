/**
 * Mirrors `app/backend`'s `AuditLogPresenter.presentAuditLog()` JSON shape exactly — see
 * `apiClient.ts`'s doc comment for why this pilot hand-maintains DTOs instead of generating them.
 * No branch dimension exists on the audit log table, so this endpoint is MIS-only and global.
 */
export interface AuditLog {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

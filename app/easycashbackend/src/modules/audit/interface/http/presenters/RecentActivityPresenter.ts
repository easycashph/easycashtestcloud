import type { AuditLogRecord } from '../../../application/ports/IAuditLogRepository';

/**
 * Stripped-down shape for the all-roles "Recent System Activity" widget - deliberately omits
 * previousValue/newValue/ipAddress/userAgent/userEmail/userId, which `AuditLogPresenter` includes
 * for the MIS-only full audit trail. Anyone can see "who did what, to which record, when"; only
 * MIS can see the raw before/after values and network metadata.
 */
export interface RecentActivityResponse {
  id: string;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  createdAt: string;
}

export function presentRecentActivity(record: AuditLogRecord): RecentActivityResponse {
  return {
    id: record.id,
    userName: record.user ? `${record.user.firstName} ${record.user.lastName}` : null,
    action: record.action,
    entityType: record.entityType,
    entityId: record.entityId,
    entityLabel: record.entityLabel,
    createdAt: record.createdAt.toISOString(),
  };
}
